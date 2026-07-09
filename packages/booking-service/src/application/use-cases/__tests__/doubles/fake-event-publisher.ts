import type { DomainEvent } from '@move/shared';

import type { IEventPublisher } from '../../../../domain/ports/event-publisher.port';

export class FakeEventPublisher implements IEventPublisher {
  readonly published: Array<{ exchange: string; routingKey: string; event: DomainEvent }> = [];

  publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    this.published.push({ exchange, routingKey, event });
    return Promise.resolve();
  }
}
