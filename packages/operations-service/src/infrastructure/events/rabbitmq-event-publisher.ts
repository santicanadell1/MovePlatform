import type { DomainEvent } from '@move/shared';
import type { Channel } from 'amqplib';
import { inject, injectable } from 'inversify';

import type { IEventPublisher } from '../../domain/ports/event-publisher.port';
import { TYPES } from '../../types';

@injectable()
export class RabbitMQEventPublisher implements IEventPublisher {
  constructor(@inject(TYPES.RabbitMQChannel) private readonly channel: Channel) {}

  async publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
  }
}
