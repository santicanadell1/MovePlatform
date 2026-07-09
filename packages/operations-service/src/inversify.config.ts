import 'reflect-metadata';

import * as admin from 'firebase-admin';
import { Container } from 'inversify';
import { Pool } from 'pg';
import type { IAuthVerifier } from '@move/shared';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

import { GetCategoriesUseCase } from './application/use-cases/categories/get-categories.use-case';
import { CreateCategoryUseCase } from './application/use-cases/categories/create-category.use-case';
import { UpdateCategoryUseCase } from './application/use-cases/categories/update-category.use-case';
import { DeleteCategoryUseCase } from './application/use-cases/categories/delete-category.use-case';
import { GetZonesUseCase } from './application/use-cases/zones/get-zones.use-case';
import { CreateZoneUseCase } from './application/use-cases/zones/create-zone.use-case';
import { UpdateZoneUseCase } from './application/use-cases/zones/update-zone.use-case';
import { DeleteZoneUseCase } from './application/use-cases/zones/delete-zone.use-case';
import { CreateVehicleUseCase } from './application/use-cases/vehicles/create-vehicle.use-case';
import { GetVehiclesUseCase } from './application/use-cases/vehicles/get-vehicles.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/vehicles/update-vehicle.use-case';
import type { ICategoryRepository } from './domain/ports/category.repository.port';
import type { IZoneRepository } from './domain/ports/zone.repository.port';
import type { IVehicleRepository } from './domain/ports/vehicle.repository.port';
import { FirebaseAuthVerifier } from './infrastructure/auth/firebase-auth.verifier';
import { PrismaCategoryRepository } from './infrastructure/repositories/prisma-category.repository';
import { PgZoneRepository } from './infrastructure/repositories/pg-zone.repository';
import { PrismaVehicleRepository } from './infrastructure/repositories/prisma-vehicle.repository';
import { CategoryController } from './presentation/controllers/category.controller';
import { ZoneController } from './presentation/controllers/zone.controller';
import { VehicleController } from './presentation/controllers/vehicle.controller';
import { GetUsersUseCase } from './application/use-cases/users/get-users.use-case';
import { UpdateUserStatusUseCase } from './application/use-cases/users/update-user-status.use-case';
import type { IUserRepository } from './domain/ports/user.repository.port';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { UserController } from './presentation/controllers/user.controller';
import type { IReservationAssignmentRepository } from './domain/ports/reservation-assignment.repository.port';
import { PgReservationAssignmentRepository } from './infrastructure/repositories/pg-reservation-assignment.repository';
import { AssignReservationUseCase } from './application/use-cases/operations/assign-reservation.use-case';
import { OperationsController } from './presentation/controllers/operations.controller';
import type { IActiveTransfersRepository } from './domain/ports/active-transfers.repository.port';
import { PgActiveTransfersRepository } from './infrastructure/repositories/pg-active-transfers.repository';
import { GetActiveTransfersUseCase } from './application/use-cases/operations/get-active-transfers.use-case';
import { PrismaClient } from './generated/client';
import { TYPES } from './types';

const container = new Container({ defaultScope: 'Singleton' });

const prisma = new PrismaClient();
container.bind<PrismaClient>(PrismaClient).toConstantValue(prisma);

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=operations,public',
});
container.bind<Pool>(TYPES.PgPool).toConstantValue(pgPool);

// Event publisher (TYPES.EventPublisher) — se bindea en server.ts tras startMessaging:
// RabbitMQEventPublisher si RabbitMQ está disponible, NoOpEventPublisher en caso contrario.

// Repositories
container.bind<ICategoryRepository>(TYPES.CategoryRepository).to(PrismaCategoryRepository);
container.bind<IZoneRepository>(TYPES.ZoneRepository).to(PgZoneRepository);
container.bind<IVehicleRepository>(TYPES.VehicleRepository).to(PrismaVehicleRepository);

// Auth
container.bind<IAuthVerifier>(TYPES.AuthVerifier).to(FirebaseAuthVerifier);

// Use Cases — Category
container.bind<GetCategoriesUseCase>(TYPES.GetCategoriesUseCase).to(GetCategoriesUseCase);
container.bind<CreateCategoryUseCase>(TYPES.CreateCategoryUseCase).to(CreateCategoryUseCase);
container.bind<UpdateCategoryUseCase>(TYPES.UpdateCategoryUseCase).to(UpdateCategoryUseCase);
container.bind<DeleteCategoryUseCase>(TYPES.DeleteCategoryUseCase).to(DeleteCategoryUseCase);

// Use Cases — Zone
container.bind<GetZonesUseCase>(TYPES.GetZonesUseCase).to(GetZonesUseCase);
container.bind<CreateZoneUseCase>(TYPES.CreateZoneUseCase).to(CreateZoneUseCase);
container.bind<UpdateZoneUseCase>(TYPES.UpdateZoneUseCase).to(UpdateZoneUseCase);
container.bind<DeleteZoneUseCase>(TYPES.DeleteZoneUseCase).to(DeleteZoneUseCase);

// Use Cases — Vehicle
container.bind<GetVehiclesUseCase>(TYPES.GetVehiclesUseCase).to(GetVehiclesUseCase);
container.bind<CreateVehicleUseCase>(TYPES.CreateVehicleUseCase).to(CreateVehicleUseCase);
container.bind<UpdateVehicleUseCase>(TYPES.UpdateVehicleUseCase).to(UpdateVehicleUseCase);

// Controllers
container.bind<CategoryController>(TYPES.CategoryController).to(CategoryController);
container.bind<ZoneController>(TYPES.ZoneController).to(ZoneController);
container.bind<VehicleController>(TYPES.VehicleController).to(VehicleController);

// Repository — User
container.bind<IUserRepository>(TYPES.UserRepository).to(PrismaUserRepository);

// Use Cases — User
container.bind<GetUsersUseCase>(TYPES.GetUsersUseCase).to(GetUsersUseCase);
container.bind<UpdateUserStatusUseCase>(TYPES.UpdateUserStatusUseCase).to(UpdateUserStatusUseCase);

// Controller — User
container.bind<UserController>(TYPES.UserController).to(UserController);

// Repository — ReservationAssignment
container
  .bind<IReservationAssignmentRepository>(TYPES.ReservationAssignmentRepository)
  .to(PgReservationAssignmentRepository);
container
  .bind<AssignReservationUseCase>(TYPES.AssignReservationUseCase)
  .to(AssignReservationUseCase);
container.bind<OperationsController>(TYPES.OperationsController).to(OperationsController);

// Repository + Use Case — Active Transfers (F18)
container
  .bind<IActiveTransfersRepository>(TYPES.ActiveTransfersRepository)
  .to(PgActiveTransfersRepository);
container
  .bind<GetActiveTransfersUseCase>(TYPES.GetActiveTransfersUseCase)
  .to(GetActiveTransfersUseCase);

export { container };
