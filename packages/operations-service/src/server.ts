import 'dotenv/config';

import type { Channel } from 'amqplib';
import type { Pool } from 'pg';

import { buildApp } from './app';
import { container } from './inversify.config';
import type { IEventPublisher } from './domain/ports/event-publisher.port';
import { NoOpEventPublisher } from './infrastructure/events/noop-event-publisher';
import { RabbitMQEventPublisher } from './infrastructure/events/rabbitmq-event-publisher';
import { logger } from './infrastructure/logger';
import { startMessaging } from './infrastructure/messaging/messaging.bootstrap';
import { TYPES } from './types';

const PORT = Number(process.env.PORT) || 3002;

const start = async (): Promise<void> => {
  try {
    const pool = container.get<Pool>(TYPES.PgPool);
    const { channel } = await startMessaging(pool, logger);
    container.bind<Channel>(TYPES.RabbitMQChannel).toConstantValue(channel);
    container
      .bind<IEventPublisher>(TYPES.EventPublisher)
      .toDynamicValue(
        (ctx) => new RabbitMQEventPublisher(ctx.container.get<Channel>(TYPES.RabbitMQChannel)),
      );
  } catch (err) {
    logger.error('No se pudo iniciar messaging de operations — proyecciones no se actualizarán', {
      err,
    });
    container.bind<IEventPublisher>(TYPES.EventPublisher).to(NoOpEventPublisher);
  }

  const app = buildApp();

  await new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      logger.info('operations-service iniciado', { port: PORT });
      resolve();
    });
  });
};

start().catch((err: unknown) => {
  logger.error('Error al iniciar operations-service', { err });
  process.exit(1);
});
