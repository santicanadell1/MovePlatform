import { ReservationStatus } from '@move/shared';

import type { Reservation } from '../../domain/entities/reservation.entity';
import { ReservationNotPendingClassificationError } from '../../domain/errors/category.errors';
import { ReservationNotFoundError } from '../../domain/errors/reservation.errors';
import type { IEmailService } from '../../domain/ports/email.service.port';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import { logger } from '../../infrastructure/logger';

export interface RejectReservationInput {
  reservationId: string;
}

export class RejectReservationUseCase {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: RejectReservationInput): Promise<Reservation> {
    const { reservationId } = input;

    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    if (reservation.status !== ReservationStatus.PENDING_CLASSIFICATION) {
      throw new ReservationNotPendingClassificationError(reservationId);
    }

    const rejected = reservation.withStatus(ReservationStatus.REJECTED);
    await this.reservationRepo.update(rejected);

    const client = await this.userRepo.findById(reservation.clientId);
    if (client) {
      const itemDescription =
        reservation.goods?.map((g) => g.description).join(', ') ?? 'bienes no especificados';

      await this.emailService.sendRejection({
        to: client.email,
        clientName: client.name,
        reservationId,
        itemDescription,
      });
    } else {
      logger.warn('RejectReservationUseCase: cliente no encontrado, email omitido', {
        reservationId,
        clientId: reservation.clientId,
      });
    }

    return rejected;
  }
}
