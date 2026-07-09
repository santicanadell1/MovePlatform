import 'reflect-metadata';

import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Channel } from 'amqplib';
import Redis from 'ioredis';
import { createAuditMiddleware, runReadinessChecks } from '@move/shared';

import { PrismaClient } from './generated/client';
import { logger } from './infrastructure/logger';
import { httpMetricsMiddleware, register } from './infrastructure/metrics/metrics';
import { buildContainer } from './inversify.config';
import { PricingService } from './application/services/pricing.service';
import { TYPES } from './types';
import { createAdminRouter } from './presentation/routes/admin.routes';
import { createCompanyLocationRouter } from './presentation/routes/company-location.routes';
import { createCompanyProductRouter } from './presentation/routes/company-product.routes';
import { createReservationRouter } from './presentation/routes/reservation.routes';
import { createAuthRouter } from './presentation/routes/auth.routes';
import type { ReservationClassifiedConsumer } from './infrastructure/messaging/reservation-classified.consumer';
import type { ReservationAssignedConsumer } from './infrastructure/messaging/reservation-assigned.consumer';
import type { TransferCompletedConsumer } from './infrastructure/messaging/transfer-completed.consumer';

export const buildApp = async (): Promise<Application> => {
  const container = await buildContainer();

  const pricingService = container.get<PricingService>(TYPES.PricingService);
  await pricingService.loadAtBoot();
  logger.info('PricingService: reglas cargadas');

  const consumer = container.get<ReservationClassifiedConsumer>(
    TYPES.ReservationClassifiedConsumer,
  );
  await consumer.start();
  logger.info('ReservationClassifiedConsumer: escuchando reservation.classified');

  const assignedConsumer = container.get<ReservationAssignedConsumer>(
    TYPES.ReservationAssignedConsumer,
  );
  await assignedConsumer.start();

  const transferCompletedConsumer = container.get<TransferCompletedConsumer>(
    TYPES.TransferCompletedConsumer,
  );
  await transferCompletedConsumer.start();
  logger.info('TransferCompletedConsumer: escuchando transfer.completed');

  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware(logger));
  app.use(httpMetricsMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'booking-service' });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    const prisma = container.get<PrismaClient>(PrismaClient);
    const redis = container.get<Redis>('RedisClient');
    const channel = container.isBound(TYPES.RabbitMQChannel)
      ? container.get<Channel>(TYPES.RabbitMQChannel)
      : null;

    void runReadinessChecks({
      postgres: async () => {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      },
      redis: async () => {
        const pong = await redis.ping();
        return pong === 'PONG';
      },
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

  app.use('/v1/auth', createAuthRouter(container));
  app.use('/v1/companies/products', createCompanyProductRouter(container));
  app.use('/v1/companies/locations', createCompanyLocationRouter(container));
  app.use('/v1/reservas', createReservationRouter(container));
  app.use('/v1/admin', createAdminRouter(container));

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { err, traceId: req.traceId });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};
