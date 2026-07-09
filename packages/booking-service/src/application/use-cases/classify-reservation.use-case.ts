import { randomUUID } from 'node:crypto';

import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS, ReservationStatus } from '@move/shared';
import type { ReservationClassifiedEvent } from '@move/shared';

import {
  CategoryNotFoundError,
  ReservationNotPendingClassificationError,
} from '../../domain/errors/category.errors';
import { ReservationNotFoundError } from '../../domain/errors/reservation.errors';
import type { ICategoryRepository } from '../../domain/ports/category.repository.port';
import type { IEventPublisher } from '../../domain/ports/event-publisher.port';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';

import type { ResumeClassifiedReservationUseCase } from './resume-classified-reservation.use-case';

interface ClassifyInput {
  reservationId: string;
  categoryId: string;
}

interface ClassifyOutput {
  reservationId: string;
  status: ReservationStatus;
}

export class ClassifyReservationUseCase {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly resumeUseCase: ResumeClassifiedReservationUseCase,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute({ reservationId, categoryId }: ClassifyInput): Promise<ClassifyOutput> {
    const result = await this.reservationRepo.findByIdWithGoods(reservationId);
    if (!result) throw new ReservationNotFoundError(reservationId);
    if (result.reservation.status !== ReservationStatus.PENDING_CLASSIFICATION) {
      throw new ReservationNotPendingClassificationError(reservationId);
    }

    const category = await this.categoryRepo.findById(categoryId);
    if (!category) throw new CategoryNotFoundError(categoryId);

    const event: ReservationClassifiedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      reservationId,
      categoryId,
      categoryName: category.name,
    };

    await this.resumeUseCase.execute(event);

    await this.eventPublisher.publish(
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.RESERVATION_CLASSIFIED,
      event,
    );

    return { reservationId, status: ReservationStatus.QUOTED };
  }
}
