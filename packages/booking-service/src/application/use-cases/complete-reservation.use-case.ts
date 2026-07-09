import { ReservationStatus } from '@move/shared';

import type { Reservation } from '../../domain/entities/reservation.entity';
import { ReservationNotFoundError } from '../../domain/errors/reservation.errors';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';

export interface CompleteReservationInput {
  reservationId: string;
}

export class CompleteReservationUseCase {
  constructor(private readonly reservationRepo: IReservationRepository) {}

  async execute(input: CompleteReservationInput): Promise<Reservation> {
    const { reservationId } = input;

    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    if (reservation.status === ReservationStatus.COMPLETED) {
      return reservation;
    }

    const completed = reservation.withStatus(ReservationStatus.COMPLETED);
    return this.reservationRepo.update(completed);
  }
}
