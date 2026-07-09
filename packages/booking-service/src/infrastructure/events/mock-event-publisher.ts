import type { DomainEvent } from '@move/shared';

import { logger } from '../logger';
import type { IEventPublisher } from '../../domain/ports/event-publisher.port';

export class MockEventPublisher implements IEventPublisher {
  publish(exchange: string, routingKey: string, event: DomainEvent): Promise<void> {
    logger.info('MockEventPublisher: evento publicado', {
      exchange,
      routingKey,
      eventId: event.eventId,
    });
    return Promise.resolve();
  }
}
