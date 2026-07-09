import 'reflect-metadata';

import express from 'express';
import { Container } from 'inversify';
import { Pool } from 'pg';
import type { Application } from 'express';
import type { DomainEvent, IAuthVerifier } from '@move/shared';

import { PrismaClient } from '../generated/client';
import { TYPES } from '../types';
import type { ICacheService } from '../application/ports/cache.service';
import type { IEventPublisher } from '../application/ports/event-publisher';
import type { IGpsQueueService, GpsJobPayload } from '../application/ports/gps-queue.service';
import { PrismaTransferRepository } from '../infrastructure/repositories/prisma-transfer.repository';
import { PrismaGpsPointRepository } from '../infrastructure/repositories/prisma-gps-point.repository';
import { PrismaAlertRepository } from '../infrastructure/repositories/prisma-alert.repository';
import { PrismaIncidentRepository } from '../infrastructure/repositories/prisma-incident.repository';
import { RedisZoneRepository } from '../infrastructure/repositories/redis-zone.repository';
import { PgVehicleRegistryRepository } from '../infrastructure/repositories/pg-vehicle-registry.repository';
import { StartTransferUseCase } from '../application/use-cases/start-transfer.use-case';
import { FinishTransferUseCase } from '../application/use-cases/finish-transfer.use-case';
import { ReceiveGpsPointUseCase } from '../application/use-cases/receive-gps-point.use-case';
import { ReportIncidentUseCase } from '../application/use-cases/report-incident.use-case';
import { GetIncidentsByTransferUseCase } from '../application/use-cases/get-incidents-by-transfer.use-case';
import { TransferController } from '../presentation/controllers/transfer.controller';
import { GpsController } from '../presentation/controllers/gps.controller';
import { IncidentController } from '../presentation/controllers/incident.controller';
import { createTransferRouter } from '../presentation/routes/transfer.routes';
import { createGpsRouter } from '../presentation/routes/gps.routes';
import { createIncidentRouter } from '../presentation/routes/incident.routes';

import { FakeAuthVerifier } from './fake-auth.verifier';

// ── No-op fakes para servicios externos ──────────────────────────────────────

class NoOpEventPublisher implements IEventPublisher {
  publish(_exchange: string, _routingKey: string, _event: DomainEvent): Promise<void> {
    return Promise.resolve();
  }
}

class NoOpGpsQueueService implements IGpsQueueService {
  enqueueP1(_payload: GpsJobPayload): Promise<void> {
    return Promise.resolve();
  }
}

// Cache in-memory para que transfer:active:{deviceId} funcione sin Redis real
class InMemoryCacheService implements ICacheService {
  private readonly store = new Map<string, string>();

  set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}

export interface TestAppResult {
  app: Application;
  prisma: PrismaClient;
  pgPool: Pool;
}

export function buildTestApp(): TestAppResult {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env['DATABASE_URL'] } },
  });

  const pgPool = new Pool({ connectionString: process.env['DATABASE_URL'] });

  const container = new Container({ defaultScope: 'Singleton' });

  // ── Auth fake ───────────────────────────────────────────────────────────────
  container.bind<IAuthVerifier>(TYPES.AuthService).toConstantValue(new FakeAuthVerifier());

  // ── Repositories (Prisma + pg reales) ──────────────────────────────────────
  container.bind(TYPES.PrismaClient).toConstantValue(prisma);
  container.bind(TYPES.PgPool).toConstantValue(pgPool);
  container.bind(TYPES.TransferRepository).to(PrismaTransferRepository);
  container.bind(TYPES.GpsPointRepository).to(PrismaGpsPointRepository);
  container.bind(TYPES.AlertRepository).to(PrismaAlertRepository);
  container.bind(TYPES.IncidentRepository).to(PrismaIncidentRepository);
  container.bind(TYPES.ZoneRepository).to(RedisZoneRepository);
  container.bind(TYPES.VehicleRegistryRepository).to(PgVehicleRegistryRepository);

  // ── Servicios externos (no-op / in-memory) ──────────────────────────────────
  container.bind<ICacheService>(TYPES.CacheService).toConstantValue(new InMemoryCacheService());
  container.bind<IEventPublisher>(TYPES.EventPublisher).toConstantValue(new NoOpEventPublisher());
  container
    .bind<IGpsQueueService>(TYPES.GpsQueueService)
    .toConstantValue(new NoOpGpsQueueService());

  // ── Use Cases ───────────────────────────────────────────────────────────────
  container.bind(TYPES.StartTransferUseCase).to(StartTransferUseCase);
  container.bind(TYPES.FinishTransferUseCase).to(FinishTransferUseCase);
  container.bind(TYPES.ReceiveGpsPointUseCase).to(ReceiveGpsPointUseCase);
  container.bind(TYPES.ReportIncidentUseCase).to(ReportIncidentUseCase);
  container.bind(TYPES.GetIncidentsByTransferUseCase).to(GetIncidentsByTransferUseCase);

  // ── Controllers ─────────────────────────────────────────────────────────────
  container.bind(TYPES.TransferController).to(TransferController);
  container.bind(TYPES.GpsController).to(GpsController);
  container.bind(TYPES.IncidentController).to(IncidentController);

  // ── Express app mínima (sin pipeline Bull) ──────────────────────────────────
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/tracking/traslados', createTransferRouter(container));
  app.use('/api/tracking/gps', createGpsRouter(container));
  app.use('/api/tracking/traslados/:reservationId/incidencias', createIncidentRouter(container));

  return { app, prisma, pgPool };
}
