import 'reflect-metadata';

import express, { type Application } from 'express';
import { Container } from 'inversify';
import { Pool } from 'pg';
import type { IAuthVerifier } from '@move/shared';

import { PrismaClient } from '../generated/client';
import { TYPES } from '../types';
import type { IActiveTransfersRepository } from '../domain/ports/active-transfers.repository.port';
import type { ICategoryRepository } from '../domain/ports/category.repository.port';
import type { IEventPublisher } from '../domain/ports/event-publisher.port';
import type { IReservationAssignmentRepository } from '../domain/ports/reservation-assignment.repository.port';
import type { IUserRepository } from '../domain/ports/user.repository.port';
import type { IVehicleRepository } from '../domain/ports/vehicle.repository.port';
import type { IZoneRepository } from '../domain/ports/zone.repository.port';
import { NoOpEventPublisher } from '../infrastructure/events/noop-event-publisher';
import { PgActiveTransfersRepository } from '../infrastructure/repositories/pg-active-transfers.repository';
import { PgReservationAssignmentRepository } from '../infrastructure/repositories/pg-reservation-assignment.repository';
import { PgZoneRepository } from '../infrastructure/repositories/pg-zone.repository';
import { PrismaCategoryRepository } from '../infrastructure/repositories/prisma-category.repository';
import { PrismaUserRepository } from '../infrastructure/repositories/prisma-user.repository';
import { PrismaVehicleRepository } from '../infrastructure/repositories/prisma-vehicle.repository';
import { DeleteCategoryUseCase } from '../application/use-cases/categories/delete-category.use-case';
import { GetCategoriesUseCase } from '../application/use-cases/categories/get-categories.use-case';
import { CreateCategoryUseCase } from '../application/use-cases/categories/create-category.use-case';
import { UpdateCategoryUseCase } from '../application/use-cases/categories/update-category.use-case';
import { GetActiveTransfersUseCase } from '../application/use-cases/operations/get-active-transfers.use-case';
import { AssignReservationUseCase } from '../application/use-cases/operations/assign-reservation.use-case';
import { GetUsersUseCase } from '../application/use-cases/users/get-users.use-case';
import { UpdateUserStatusUseCase } from '../application/use-cases/users/update-user-status.use-case';
import { CreateVehicleUseCase } from '../application/use-cases/vehicles/create-vehicle.use-case';
import { GetVehiclesUseCase } from '../application/use-cases/vehicles/get-vehicles.use-case';
import { UpdateVehicleUseCase } from '../application/use-cases/vehicles/update-vehicle.use-case';
import { CreateZoneUseCase } from '../application/use-cases/zones/create-zone.use-case';
import { DeleteZoneUseCase } from '../application/use-cases/zones/delete-zone.use-case';
import { GetZonesUseCase } from '../application/use-cases/zones/get-zones.use-case';
import { UpdateZoneUseCase } from '../application/use-cases/zones/update-zone.use-case';
import { CategoryController } from '../presentation/controllers/category.controller';
import { OperationsController } from '../presentation/controllers/operations.controller';
import { UserController } from '../presentation/controllers/user.controller';
import { VehicleController } from '../presentation/controllers/vehicle.controller';
import { ZoneController } from '../presentation/controllers/zone.controller';
import { createCategoryRouter } from '../presentation/routes/category.routes';
import { createOperationsRouter } from '../presentation/routes/operations.routes';
import { createTransfersRouter } from '../presentation/routes/transfers.routes';
import { createUserRouter } from '../presentation/routes/user.routes';
import { createVehicleRouter } from '../presentation/routes/vehicle.routes';
import { createZoneRouter } from '../presentation/routes/zone.routes';

import { FakeAuthVerifier } from './fake-auth.verifier';

export interface TestAppResult {
  app: Application;
  prisma: PrismaClient;
  pool: Pool;
}

function withOperationsSchema(url: string): string {
  if (url.includes('schema=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}schema=operations`;
}

export async function buildTestApp(): Promise<TestAppResult> {
  const prisma = new PrismaClient({
    datasources: { db: { url: withOperationsSchema(process.env['DATABASE_URL'] ?? '') } },
  });

  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
    options: '-c search_path=operations,public',
  });

  // Verify connectivity eagerly so tests fail fast with a clear error
  await pool.query('SELECT 1');

  const container = new Container({ defaultScope: 'Singleton' });

  container.bind<IAuthVerifier>(TYPES.AuthVerifier).toConstantValue(new FakeAuthVerifier());
  container.bind<PrismaClient>(PrismaClient).toConstantValue(prisma);
  container.bind<Pool>(TYPES.PgPool).toConstantValue(pool);
  container.bind<IEventPublisher>(TYPES.EventPublisher).toConstantValue(new NoOpEventPublisher());

  container.bind<ICategoryRepository>(TYPES.CategoryRepository).to(PrismaCategoryRepository);
  container.bind<IZoneRepository>(TYPES.ZoneRepository).to(PgZoneRepository);
  container.bind<IVehicleRepository>(TYPES.VehicleRepository).to(PrismaVehicleRepository);
  container.bind<IUserRepository>(TYPES.UserRepository).to(PrismaUserRepository);
  container
    .bind<IReservationAssignmentRepository>(TYPES.ReservationAssignmentRepository)
    .to(PgReservationAssignmentRepository);
  container
    .bind<IActiveTransfersRepository>(TYPES.ActiveTransfersRepository)
    .to(PgActiveTransfersRepository);

  container.bind<GetCategoriesUseCase>(TYPES.GetCategoriesUseCase).to(GetCategoriesUseCase);
  container.bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase).to(CreateCategoryUseCase);
  container.bind<UpdateCategoryUseCase>(TYPES.UpdateCategoryUseCase).to(UpdateCategoryUseCase);
  container.bind<DeleteCategoryUseCase>(TYPES.DeleteCategoryUseCase).to(DeleteCategoryUseCase);
  container.bind<GetZonesUseCase>(TYPES.GetZonesUseCase).to(GetZonesUseCase);
  container.bind<CreateZoneUseCase>(TYPES.CreateZoneUseCase).to(CreateZoneUseCase);
  container.bind<UpdateZoneUseCase>(TYPES.UpdateZoneUseCase).to(UpdateZoneUseCase);
  container.bind<DeleteZoneUseCase>(TYPES.DeleteZoneUseCase).to(DeleteZoneUseCase);
  container.bind<GetVehiclesUseCase>(TYPES.GetVehiclesUseCase).to(GetVehiclesUseCase);
  container.bind<CreateVehicleUseCase>(TYPES.CreateVehicleUseCase).to(CreateVehicleUseCase);
  container.bind<UpdateVehicleUseCase>(TYPES.UpdateVehicleUseCase).to(UpdateVehicleUseCase);
  container.bind<GetUsersUseCase>(TYPES.GetUsersUseCase).to(GetUsersUseCase);
  container
    .bind<UpdateUserStatusUseCase>(TYPES.UpdateUserStatusUseCase)
    .to(UpdateUserStatusUseCase);
  container
    .bind<AssignReservationUseCase>(TYPES.AssignReservationUseCase)
    .to(AssignReservationUseCase);
  container
    .bind<GetActiveTransfersUseCase>(TYPES.GetActiveTransfersUseCase)
    .to(GetActiveTransfersUseCase);

  container.bind<CategoryController>(TYPES.CategoryController).to(CategoryController);
  container.bind<ZoneController>(TYPES.ZoneController).to(ZoneController);
  container.bind<VehicleController>(TYPES.VehicleController).to(VehicleController);
  container.bind<UserController>(TYPES.UserController).to(UserController);
  container.bind<OperationsController>(TYPES.OperationsController).to(OperationsController);

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/operaciones/categorias', createCategoryRouter(container));
  app.use('/api/zonas', createZoneRouter(container));
  app.use('/api/operaciones/vehiculos', createVehicleRouter(container));
  app.use('/api/operaciones/usuarios', createUserRouter(container));
  app.use('/api/operaciones/reservas', createOperationsRouter(container));
  app.use('/api/operaciones/traslados', createTransfersRouter(container));

  return { app, prisma, pool };
}
