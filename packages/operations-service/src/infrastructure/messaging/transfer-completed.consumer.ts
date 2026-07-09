import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type TransferCompletedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class TransferCompletedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.OPERATIONS_TRANSFER_COMPLETED;
    const routingKey = RABBITMQ_ROUTING_KEYS.TRANSFER_COMPLETED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.consume(queue, (msg) => {
      void this.handle(msg);
    });
    this.logger.info('Consumer iniciado: transfer.completed');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as TransferCompletedEvent;
      await this.pool.query(
        `UPDATE operations.transfers_projection
         SET status = 'COMPLETED', finished_at = $1 WHERE id = $2`,
        [ev.finishedAt, ev.transferId],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando transfer.completed', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
