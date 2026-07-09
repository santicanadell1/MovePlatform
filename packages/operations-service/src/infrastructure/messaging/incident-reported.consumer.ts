import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type IncidentReportedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';

export class IncidentReportedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const dlx = RABBITMQ_EXCHANGES.MOVE_DLX;
    const queue = RABBITMQ_QUEUES.OPERATIONS_INCIDENT;
    const dlqQueue = `${queue}.dlq`;
    const routingKey = RABBITMQ_ROUTING_KEYS.INCIDENT_REPORTED;

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
    this.logger.info('Consumer iniciado: incident.reported');
  }

  private handle = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as IncidentReportedEvent;
      await this.pool.query(
        `INSERT INTO operations.incidents_projection
           (id, transfer_id, conductor_id, description, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [ev.incidentId, ev.transferId, ev.conductorId, ev.description, ev.occurredAt],
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando incident.reported', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
