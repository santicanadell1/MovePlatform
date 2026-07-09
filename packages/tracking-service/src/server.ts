import 'dotenv/config';

import { buildApp } from './app';
import { initRabbitMQ } from './inversify.config';
import { logger } from './infrastructure/logger';

const PORT = Number(process.env.PORT) || 3003;

const start = async (): Promise<void> => {
  await initRabbitMQ();
  const app = buildApp();

  await new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      logger.info('tracking-service iniciado', { port: PORT });
      resolve();
    });
  });
};

start().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Error al iniciar tracking-service', { message, stack });
  process.exit(1);
});
