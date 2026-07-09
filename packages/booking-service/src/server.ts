import 'dotenv/config';

import { buildApp } from './app';
import { logger } from './infrastructure/logger';

const PORT = Number(process.env.PORT) || 3001;

const start = async (): Promise<void> => {
  const app = await buildApp();

  await new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      logger.info('booking-service iniciado', { port: PORT });
      resolve();
    });
  });
};

start().catch((err: unknown) => {
  logger.error('Error al iniciar booking-service', { err });
  process.exit(1);
});
