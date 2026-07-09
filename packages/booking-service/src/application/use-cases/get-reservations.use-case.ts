import { ReservationStatus, UserRole } from '@move/shared';

import { UserNotFoundError } from '../../domain/errors/auth.errors';
import type {
  IReservationRepository,
  ReservationPage,
} from '../../domain/ports/reservation.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

export interface GetReservationsInput {
  readonly firebaseUid: string;
  readonly role: UserRole;
  readonly status?: ReservationStatus;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly cursor?: string;
  readonly limit: number;
}

export class GetReservationsUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly reservationRepo: IReservationRepository,
  ) {}

  async execute(input: GetReservationsInput): Promise<ReservationPage> {
    const { firebaseUid, role, status, dateFrom, dateTo, cursor, limit } = input;

    let clientId: string | undefined;

    if (role === UserRole.CLIENT_PARTICULAR || role === UserRole.CLIENT_EMPRESA) {
      const user = await this.userRepo.findByFirebaseUid(firebaseUid);
      if (!user) throw new UserNotFoundError(firebaseUid);
      clientId = user.id;
    }

    return this.reservationRepo.findWithFilters({
      clientId,
      status,
      dateFrom,
      dateTo,
      cursor,
      limit,
    });
  }
}
