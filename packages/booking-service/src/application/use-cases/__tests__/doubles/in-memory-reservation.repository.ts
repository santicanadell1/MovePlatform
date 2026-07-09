import { ReservationStatus } from '@move/shared';

import type { Good } from '../../../../domain/entities/good.entity';
import { Reservation } from '../../../../domain/entities/reservation.entity';
import type {
  IReservationRepository,
  ReservationFilters,
  ReservationPage,
  ReservationWithGoods,
} from '../../../../domain/ports/reservation.repository.port';

export class InMemoryReservationRepository implements IReservationRepository {
  private reservations: Map<string, Reservation> = new Map();
  private goods: Map<string, Good[]> = new Map();

  save(reservation: Reservation, goods: Good[]): Promise<Reservation> {
    this.reservations.set(reservation.id, reservation);
    this.goods.set(reservation.id, [...goods]);
    return Promise.resolve(reservation);
  }

  findById(id: string): Promise<Reservation | null> {
    return Promise.resolve(this.reservations.get(id) ?? null);
  }

  findByIdWithGoods(id: string): Promise<ReservationWithGoods | null> {
    const reservation = this.reservations.get(id);
    if (!reservation) return Promise.resolve(null);
    return Promise.resolve({ reservation, goods: [...(this.goods.get(id) ?? [])] });
  }

  findByClientId(clientId: string): Promise<Reservation[]> {
    return Promise.resolve([...this.reservations.values()].filter((r) => r.clientId === clientId));
  }

  update(reservation: Reservation): Promise<Reservation> {
    this.reservations.set(reservation.id, reservation);
    return Promise.resolve(reservation);
  }

  updateGoods(reservationId: string, goods: Good[]): Promise<void> {
    this.goods.set(reservationId, [...goods]);
    return Promise.resolve();
  }

  assignFromEvent(reservationId: string, _vehicleId: string, _conductorId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    if (reservation) {
      this.reservations.set(reservationId, reservation.withStatus(ReservationStatus.ASSIGNED));
    }
    return Promise.resolve();
  }

  getGoods(reservationId: string): Good[] {
    return this.goods.get(reservationId) ?? [];
  }

  findWithFilters(filters: ReservationFilters): Promise<ReservationPage> {
    const { clientId, status, dateFrom, dateTo, cursor, limit } = filters;

    let all = [...this.reservations.values()];

    if (clientId !== undefined) all = all.filter((r) => r.clientId === clientId);
    if (status !== undefined) all = all.filter((r) => r.status === status);
    if (dateFrom !== undefined) all = all.filter((r) => r.scheduledDate >= dateFrom);
    if (dateTo !== undefined) all = all.filter((r) => r.scheduledDate <= dateTo);

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (cursor !== undefined) {
      const idx = all.findIndex((r) => r.id === cursor);
      all = idx >= 0 ? all.slice(idx + 1) : [];
    }

    const page = all.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const reservations = hasMore ? page.slice(0, limit) : page;
    const nextCursor = hasMore ? reservations[reservations.length - 1]?.id : undefined;

    const withGoods = reservations.map((r) =>
      Reservation.create({ ...r, goods: this.getGoods(r.id) }),
    );

    return Promise.resolve({ reservations: withGoods, nextCursor });
  }
}
