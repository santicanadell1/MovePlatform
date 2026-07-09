import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type TransferStartedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class TransferStartedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.OPERATIONS_TRANSFER_STARTED;
    const routingKey = RABBITMQ_ROUTING_KEYS.TRANSFER_STARTED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.consume(queue, (msg) => {
      void this.handle(msg);
    });
    this.logger.info('Consumer iniciado: transfer.started');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as TransferStartedEvent;

      // Origin/destination/categoría desde la proyección de reservas (mismo schema)
      const res = await this.pool.query<{
        origin: string;
        destination: string;
        category_id: string | null;
      }>(
        `SELECT origin, destination, category_id
         FROM operations.reservations_projection WHERE id = $1`,
        [ev.reservationId],
      );
      const origin = res.rows[0]?.origin ?? null;
      const destination = res.rows[0]?.destination ?? null;
      const categoryId = res.rows[0]?.category_id ?? null;

      await this.pool.query(
        `INSERT INTO operations.transfers_projection
           (id, reservation_id, vehicle_id, conductor_id, status, origin, destination, category_id, started_at, created_at)
         VALUES ($1, $2, $3, $4, 'IN_TRANSIT', $5, $6, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE
           SET status = 'IN_TRANSIT', started_at = $8`,
        [
          ev.transferId,
          ev.reservationId,
          ev.vehicleId,
          ev.conductorId,
          origin,
          destination,
          categoryId,
          ev.startedAt,
        ],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando transfer.started', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
