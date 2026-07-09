import { injectable } from 'inversify';

import type { IEventPublisher } from '../../domain/ports/event-publisher.port';

/**
 * Publisher de respaldo cuando RabbitMQ no está disponible al arranque.
 * Permite que F12 (asignación) siga funcionando; la proyección en booking
 * se sincronizará cuando RabbitMQ vuelva (eventual consistency).
 */
@injectable()
export class NoOpEventPublisher implements IEventPublisher {
  publish(): Promise<void> {
    return Promise.resolve();
  }
}
