import type { Reservation } from '../../domain/entities/reservation.entity';
import type { Good } from '../../domain/entities/good.entity';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';
import type { IGeolocationService } from '../../domain/ports/geolocation.service.port';
import { ReservationNotFoundError } from '../../domain/errors/reservation.errors';
import type { PricingService } from '../services/pricing.service';

export class QuoteReservationUseCase {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly pricingService: PricingService,
    private readonly geoService: IGeolocationService,
  ) {}

  async execute(reservationId: string, goods: Good[]): Promise<Reservation> {
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) throw new ReservationNotFoundError(reservationId);

    const distanceKm = await this.geoService.getDistanceKm(
      { lat: reservation.originLat, lng: reservation.originLng },
      { lat: reservation.destinationLat, lng: reservation.destinationLng },
    );

    const { totalCost, costBreakdown } = this.pricingService.quote(goods, distanceKm);
    const quoted = reservation.withQuote(totalCost, costBreakdown);

    return this.reservationRepo.update(quoted);
  }
}
