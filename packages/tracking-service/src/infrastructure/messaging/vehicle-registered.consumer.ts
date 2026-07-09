import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type VehicleRegisteredEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class VehicleRegisteredConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.TRACKING_VEHICLE_REGISTERED;
    const routingKey = RABBITMQ_ROUTING_KEYS.VEHICLE_REGISTERED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    await this.channel.consume(queue, (msg) => {
      void this.handle(msg);
    });
    this.logger.info('Consumer iniciado: vehicle.registered');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as VehicleRegisteredEvent;
      await this.pool.query(
        `INSERT INTO tracking.vehicles_cache (id, gps_device_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET gps_device_id = $2`,
        [ev.vehicleId, ev.gpsDeviceId ?? null],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando vehicle.registered', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
