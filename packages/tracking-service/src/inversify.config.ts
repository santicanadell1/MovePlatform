import 'reflect-metadata';

import * as admin from 'firebase-admin';
import amqplib from 'amqplib';
import type { Channel } from 'amqplib';
import { Container } from 'inversify';
import Redis from 'ioredis';
import { Pool } from 'pg';

import { PrismaClient } from './generated/client';
import { TYPES } from './types';
import { FirebaseAuthVerifier } from './infrastructure/auth/firebase-auth.verifier';
import { PrismaTransferRepository } from './infrastructure/repositories/prisma-transfer.repository';
import { PrismaGpsPointRepository } from './infrastructure/repositories/prisma-gps-point.repository';
import { PrismaAlertRepository } from './infrastructure/repositories/prisma-alert.repository';
import { PrismaIncidentRepository } from './infrastructure/repositories/prisma-incident.repository';
import { RedisZoneRepository } from './infrastructure/repositories/redis-zone.repository';
import { PgVehicleRegistryRepository } from './infrastructure/repositories/pg-vehicle-registry.repository';
import { RedisCacheService } from './infrastructure/cache/redis-cache.service';
import { BullGpsQueueService } from './infrastructure/queues/bull-gps-queue.service';
import { RabbitMQEventPublisher } from './infrastructure/events/rabbitmq-event-publisher';
import { VehicleRegisteredConsumer } from './infrastructure/messaging/vehicle-registered.consumer';
import { ZoneEventsConsumer } from './infrastructure/messaging/zone-events.consumer';
import { logger } from './infrastructure/logger';
import { StartTransferUseCase } from './application/use-cases/start-transfer.use-case';
import { FinishTransferUseCase } from './application/use-cases/finish-transfer.use-case';
import { ReceiveGpsPointUseCase } from './application/use-cases/receive-gps-point.use-case';
import { ReportIncidentUseCase } from './application/use-cases/report-incident.use-case';
import { GetIncidentsByTransferUseCase } from './application/use-cases/get-incidents-by-transfer.use-case';
import { TransferController } from './presentation/controllers/transfer.controller';
import { GpsController } from './presentation/controllers/gps.controller';
import { IncidentController } from './presentation/controllers/incident.controller';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const container = new Container({ defaultScope: 'Singleton' });

// Clients
const prisma: PrismaClient = new PrismaClient();
const redis: Redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
container.bind(TYPES.PrismaClient).toConstantValue(prisma);
container.bind(TYPES.RedisClient).toConstantValue(redis);
container.bind(TYPES.PgPool).toConstantValue(pgPool);

// Repositories
container.bind(TYPES.TransferRepository).to(PrismaTransferRepository);
container.bind(TYPES.GpsPointRepository).to(PrismaGpsPointRepository);
container.bind(TYPES.AlertRepository).to(PrismaAlertRepository);
container.bind(TYPES.ZoneRepository).to(RedisZoneRepository);
container.bind(TYPES.VehicleRegistryRepository).to(PgVehicleRegistryRepository);
container.bind(TYPES.IncidentRepository).to(PrismaIncidentRepository);

// Auth
container.bind(TYPES.AuthService).to(FirebaseAuthVerifier);

// Services
container.bind(TYPES.CacheService).to(RedisCacheService);
container.bind(TYPES.GpsQueueService).to(BullGpsQueueService);
container.bind(TYPES.EventPublisher).to(RabbitMQEventPublisher);

// Use Cases
container.bind(TYPES.StartTransferUseCase).to(StartTransferUseCase);
container.bind(TYPES.FinishTransferUseCase).to(FinishTransferUseCase);
container.bind(TYPES.ReceiveGpsPointUseCase).to(ReceiveGpsPointUseCase);
container.bind(TYPES.ReportIncidentUseCase).to(ReportIncidentUseCase);
container.bind(TYPES.GetIncidentsByTransferUseCase).to(GetIncidentsByTransferUseCase);

// Controllers
container.bind(TYPES.TransferController).to(TransferController);
container.bind(TYPES.GpsController).to(GpsController);
container.bind(TYPES.IncidentController).to(IncidentController);

export async function initRabbitMQ(): Promise<void> {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost');
  const channel = await conn.createChannel();
  container.bind<Channel>(TYPES.RabbitMQChannel).toConstantValue(channel);

  // Consumer que mantiene tracking.vehicles_cache sincronizado con operations
  const vehicleConsumer = new VehicleRegisteredConsumer(channel, pgPool, logger);
  await vehicleConsumer.start();

  // Consumer que mantiene el caché Redis de zonas sincronizado (P4 geofencing)
  const zoneRepo = container.get<RedisZoneRepository>(TYPES.ZoneRepository);
  const zoneConsumer = new ZoneEventsConsumer(channel, zoneRepo, logger);
  await zoneConsumer.start();
}

export { container };
