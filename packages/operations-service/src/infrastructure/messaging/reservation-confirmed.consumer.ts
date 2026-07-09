import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type ReservationConfirmedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class ReservationConfirmedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.OPERATIONS_RESERVATION_CONFIRMED;
    const routingKey = RABBITMQ_ROUTING_KEYS.RESERVATION_CONFIRMED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.consume(queue, (msg) => {
      void this.handle(msg);
    });
    this.logger.info('Consumer iniciado: reservation.confirmed');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as ReservationConfirmedEvent;
      await this.pool.query(
        `INSERT INTO operations.reservations_projection
           (id, scheduled_date, origin, destination, goods_summary, category_id, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'CONFIRMED')
         ON CONFLICT (id) DO NOTHING`,
        [
          ev.reservationId,
          ev.scheduledDate,
          ev.origin,
          ev.destination,
          JSON.stringify(ev.goodsSummary),
          ev.categoryId ?? null,
        ],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando reservation.confirmed', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
