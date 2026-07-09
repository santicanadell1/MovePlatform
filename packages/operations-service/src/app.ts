import 'reflect-metadata';

import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { createAuditMiddleware, runReadinessChecks } from '@move/shared';

import { logger } from './infrastructure/logger';
import { TYPES } from './types';
import { httpMetricsMiddleware, register } from './infrastructure/metrics/metrics';
import { container } from './inversify.config';
import { createCategoryRouter } from './presentation/routes/category.routes';
import { createZoneRouter } from './presentation/routes/zone.routes';
import { createVehicleRouter } from './presentation/routes/vehicle.routes';
import { createUserRouter } from './presentation/routes/user.routes';
import { createOperationsRouter } from './presentation/routes/operations.routes';
import { createTransfersRouter } from './presentation/routes/transfers.routes';

export const buildApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(createAuditMiddleware(logger));
  app.use(httpMetricsMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'operations-service' });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    const pgPool = container.get<Pool>(TYPES.PgPool);

    void runReadinessChecks({
      postgres: async () => {
        await pgPool.query('SELECT 1');
        return true;
      },
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

  app.use('/api/operaciones/categorias', createCategoryRouter(container));
  app.use('/api/zonas', createZoneRouter(container));
  app.use('/api/operaciones/vehiculos', createVehicleRouter(container));
  app.use('/api/operaciones/usuarios', createUserRouter(container));
  app.use('/api/operaciones/reservas', createOperationsRouter(container));
  app.use('/api/operaciones/traslados', createTransfersRouter(container));

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { err, traceId: req.traceId });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};
