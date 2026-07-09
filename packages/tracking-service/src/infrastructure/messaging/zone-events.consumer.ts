import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
  type ZoneCreatedEvent,
  type ZoneDeletedEvent,
  type ZoneUpdatedEvent,
} from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'winston';

import type { RedisZoneRepository } from '../repositories/redis-zone.repository';

export class ZoneEventsConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly zoneRepo: RedisZoneRepository,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    await this.channel.assertExchange(exchange, 'topic', { durable: true });

    await this.bind(
      RABBITMQ_QUEUES.TRACKING_ZONE_CREATED,
      RABBITMQ_ROUTING_KEYS.ZONE_CREATED,
      this.handleUpsert,
    );
    await this.bind(
      RABBITMQ_QUEUES.TRACKING_ZONE_UPDATED,
      RABBITMQ_ROUTING_KEYS.ZONE_UPDATED,
      this.handleUpsert,
    );
    await this.bind(
      RABBITMQ_QUEUES.TRACKING_ZONE_DELETED,
      RABBITMQ_ROUTING_KEYS.ZONE_DELETED,
      this.handleDeleted,
    );

    this.logger.info('Consumer iniciado: zone.created/updated/deleted');
  }

  private async bind(
    queue: string,
    routingKey: string,
    handler: (msg: ConsumeMessage | null) => Promise<void>,
  ): Promise<void> {
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, RABBITMQ_EXCHANGES.MOVE_EVENTS, routingKey);
    await this.channel.consume(queue, (msg) => {
      void handler(msg);
    });
  }

  private handleUpsert = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as ZoneCreatedEvent | ZoneUpdatedEvent;
      await this.zoneRepo.upsertZone(ev.zoneId, ev.type, ev.geojson);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando zone.created/updated', { err });
      this.channel.nack(msg, false, false);
    }
  };

  private handleDeleted = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const ev = JSON.parse(msg.content.toString()) as ZoneDeletedEvent;
      await this.zoneRepo.deleteZone(ev.zoneId);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando zone.deleted', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
