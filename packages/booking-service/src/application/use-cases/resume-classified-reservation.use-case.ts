import { ReservationStatus } from '@move/shared';
import type { ReservationClassifiedEvent } from '@move/shared';

import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';

import type { QuoteReservationUseCase } from './quote-reservation.use-case';

export class ResumeClassifiedReservationUseCase {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly quoteUseCase: QuoteReservationUseCase,
  ) {}

  async execute(event: ReservationClassifiedEvent): Promise<void> {
    const result = await this.reservationRepo.findByIdWithGoods(event.reservationId);
    if (!result) return;

    const { reservation, goods } = result;
    if (reservation.status !== ReservationStatus.PENDING_CLASSIFICATION) return;

    const updatedGoods = goods.map((g) => (g.categoryId ? g : g.withCategoryId(event.categoryId)));

    await this.reservationRepo.updateGoods(event.reservationId, updatedGoods);
    await this.quoteUseCase.execute(event.reservationId, updatedGoods);
  }
}
