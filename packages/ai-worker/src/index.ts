import 'dotenv/config';

import amqplib from 'amqplib';
import Bull from 'bull';
import { createLogger, format, transports } from 'winston';
import type { AiCategorizationJob } from '@move/shared';
import { AI_QUEUES } from '@move/shared';

import { ProcessCategorizationUseCase } from './application/process-categorization.use-case';
import { RabbitMQEventPublisher } from './infrastructure/events/rabbitmq-event-publisher';
import { OllamaLLMCategorizador } from './infrastructure/ollama/ollama-llm.categorizador';

const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
});

async function main(): Promise<void> {
  const amqpConn = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost');
  const channel = await amqpConn.createChannel();

  const publisher = new RabbitMQEventPublisher(channel);
  const categorizador = new OllamaLLMCategorizador(
    process.env.OLLAMA_URL ?? 'http://localhost:11434',
    process.env.OLLAMA_MODEL ?? 'qwen2.5:3b',
  );
  const useCase = new ProcessCategorizationUseCase(categorizador, publisher);

  const queue = new Bull<AiCategorizationJob>(
    AI_QUEUES.CATEGORIZATION,
    process.env.REDIS_URL ?? 'redis://localhost:6379',
  );

  void queue.process(async (job) => {
    logger.info('Procesando job ai:categorization', { reservationId: job.data.reservationId });
    await useCase.execute(job.data);
  });

  queue.on('completed', (job: Bull.Job<AiCategorizationJob>) => {
    logger.info('Job completado', { jobId: job.id, reservationId: job.data.reservationId });
  });

  queue.on('failed', (job: Bull.Job<AiCategorizationJob> | undefined, err: Error) => {
    logger.error('Job fallido', { jobId: job?.id, err: err.message });
  });

  logger.info('ai-worker arrancado — escuchando cola ai:categorization');

  const shutdown = async (): Promise<void> => {
    logger.info('Apagando ai-worker...');
    await queue.close();
    await amqpConn.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
}

main().catch((err: unknown) => {
  logger.error('ai-worker: error fatal al arrancar', {
    err: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
