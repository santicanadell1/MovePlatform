import { randomUUID } from 'node:crypto';

import type {
  AiCategorizationJob,
  ReservationClassifiedEvent,
  ReservationUnclassifiedEvent,
} from '@move/shared';
import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS } from '@move/shared';

import type { IEventPublisher } from '../domain/ports/event-publisher.port';
import type { OllamaLLMCategorizador } from '../infrastructure/ollama/ollama-llm.categorizador';

export class ProcessCategorizationUseCase {
  constructor(
    private readonly categorizador: OllamaLLMCategorizador,
    private readonly publisher: IEventPublisher,
  ) {}

  async execute(job: AiCategorizationJob): Promise<void> {
    const result = await this.categorizador.classify(job.goodDescription, job.categories);

    if (result) {
      const event: ReservationClassifiedEvent = {
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        reservationId: job.reservationId,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
      };
      await this.publisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.RESERVATION_CLASSIFIED,
        event,
      );
    } else {
      const event: ReservationUnclassifiedEvent = {
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        reservationId: job.reservationId,
        clientId: '',
        clientEmail: '',
        goodDescription: job.goodDescription,
      };
      await this.publisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.RESERVATION_UNCLASSIFIED,
        event,
      );
    }
  }
}
