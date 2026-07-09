import amqplib, { type Channel } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

import { AlertCreatedConsumer } from './alert-created.consumer';
import { IncidentReportedConsumer } from './incident-reported.consumer';
import { ReservationConfirmedConsumer } from './reservation-confirmed.consumer';
import { TransferCompletedConsumer } from './transfer-completed.consumer';
import { TransferStartedConsumer } from './transfer-started.consumer';

export interface MessagingHandles {
  readonly channel: Channel;
}

export async function startMessaging(pool: Pool, logger: Logger): Promise<MessagingHandles> {
  const rabbitmqUrl = process.env.RABBITMQ_URL ?? 'amqp://localhost';
  const connection = await amqplib.connect(rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.prefetch(10);

  await new ReservationConfirmedConsumer(channel, pool, logger).start();
  await new TransferStartedConsumer(channel, pool, logger).start();
  await new TransferCompletedConsumer(channel, pool, logger).start();
  await new AlertCreatedConsumer(channel, pool, logger).start();
  await new IncidentReportedConsumer(channel, pool, logger).start();

  logger.info('operations-service: messaging iniciado — 5 consumers activos');
  return { channel };
}
