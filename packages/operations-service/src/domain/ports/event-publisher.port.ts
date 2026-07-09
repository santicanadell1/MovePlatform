import type { DomainEvent } from '@move/shared';

export interface IEventPublisher {
  publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void>;
}
