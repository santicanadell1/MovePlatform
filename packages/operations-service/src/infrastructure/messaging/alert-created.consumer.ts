import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type AlertCreatedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class AlertCreatedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const dlx = RABBITMQ_EXCHANGES.MOVE_DLX;
    const queue = RABBITMQ_QUEUES.OPERATIONS_ALERT;
    const dlqQueue = `${queue}.dlq`;
    const routingKey = RABBITMQ_ROUTING_KEYS.ALERT_CREATED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertExchange(dlx, 'topic', { durable: true });
    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': dlx },
    });
    await this.channel.assertQueue(dlqQueue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.bindQueue(dlqQueue, dlx, routingKey);
    await this.channel.consume(queue, (msg) => {
      void this.handle(msg);
    });
    this.logger.info('Consumer iniciado: alert.created');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as AlertCreatedEvent;
      await this.pool.query(
        `INSERT INTO operations.alerts_projection
           (id, transfer_id, type, lat, lng, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [ev.alertId, ev.transferId, ev.type, ev.lat, ev.lng, ev.message, ev.occurredAt],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando alert.created', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
