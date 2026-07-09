import { ReservationStatus } from '@move/shared';

import type { Good } from '../entities/good.entity';
import type { Reservation } from '../entities/reservation.entity';

export interface ReservationFilters {
  readonly clientId?: string;
  readonly status?: ReservationStatus;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly cursor?: string;
  readonly limit: number;
}

export interface ReservationPage {
  readonly reservations: readonly Reservation[];
  readonly nextCursor?: string;
}

export interface ReservationWithGoods {
  readonly reservation: Reservation;
  readonly goods: Good[];
}

export interface IReservationRepository {
  save(reservation: Reservation, goods: Good[]): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  findByIdWithGoods(id: string): Promise<ReservationWithGoods | null>;
  findByClientId(clientId: string): Promise<Reservation[]>;
  update(reservation: Reservation): Promise<Reservation>;
  updateGoods(reservationId: string, goods: Good[]): Promise<void>;
  findWithFilters(filters: ReservationFilters): Promise<ReservationPage>;
  assignFromEvent(reservationId: string, vehicleId: string, conductorId: string): Promise<void>;
}
