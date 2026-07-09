import 'reflect-metadata';

import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Channel } from 'amqplib';
import Redis from 'ioredis';
import { createAuditMiddleware, runReadinessChecks } from '@move/shared';

import { container } from './inversify.config';
import { logger } from './infrastructure/logger';
import { httpMetricsMiddleware, register } from './infrastructure/metrics/metrics';
import { bootstrapGpsPipeline } from './infrastructure/queues/gps-pipeline.bootstrap';
import { IAlertRepository } from './application/ports/alert.repository';
import { ICacheService } from './application/ports/cache.service';
import { IEventPublisher } from './application/ports/event-publisher';
import { IGpsPointRepository } from './application/ports/gps-point.repository';
import { IZoneRepository } from './application/ports/zone.repository';
import type { IVehicleRegistryRepository } from './application/ports/vehicle-registry.repository';
import { createTransferRouter } from './presentation/routes/transfer.routes';
import { createGpsRouter } from './presentation/routes/gps.routes';
import { createIncidentRouter } from './presentation/routes/incident.routes';
import { TYPES } from './types';

export const buildApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware(logger));
  app.use(httpMetricsMiddleware);

  const cacheService = container.get<ICacheService>(TYPES.CacheService);
  const gpsPointRepository = container.get<IGpsPointRepository>(TYPES.GpsPointRepository);
  const zoneRepository = container.get<IZoneRepository>(TYPES.ZoneRepository);
  const alertRepository = container.get<IAlertRepository>(TYPES.AlertRepository);
  const eventPublisher = container.get<IEventPublisher>(TYPES.EventPublisher);
  const vehicleRegistry = container.get<IVehicleRegistryRepository>(TYPES.VehicleRegistryRepository);
  bootstrapGpsPipeline(
    cacheService,
    gpsPointRepository,
    zoneRepository,
    alertRepository,
    eventPublisher,
    vehicleRegistry,
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'tracking-service' });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    const prisma = container.get<{ $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }>(TYPES.PrismaClient);
    const redis = container.get<Redis>(TYPES.RedisClient);
    const channel = container.isBound(TYPES.RabbitMQChannel)
      ? container.get<Channel>(TYPES.RabbitMQChannel)
      : null;

    void runReadinessChecks({
      postgres: async () => { await prisma.$queryRaw`SELECT 1`; return true; },
      redis: async () => { const pong = await redis.ping(); return pong === 'PONG'; },
      rabbitmq: () => Promise.resolve(channel !== null),
    }).then((result) => {
      res.status(result.ready ? 200 : 503).json(result);
    });
  });

  app.get('/metrics', (_req: Request, res: Response) => {
    void register.metrics().then((metrics) => {
      res.set('Content-Type', register.contentType);
      res.send(metrics);
    });
  });

  app.use('/api/tracking/traslados', createTransferRouter(container));
  app.use('/api/tracking/gps', createGpsRouter(container));
  app.use('/api/tracking/traslados/:reservationId/incidencias', createIncidentRouter(container));

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { err, traceId: req.traceId });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};
