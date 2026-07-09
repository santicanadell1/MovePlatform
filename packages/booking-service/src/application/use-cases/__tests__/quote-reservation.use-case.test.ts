import { ReservationStatus } from '@move/shared';

import { Good } from '../../../domain/entities/good.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ReservationNotFoundError } from '../../../domain/errors/reservation.errors';
import type { IGeolocationService } from '../../../domain/ports/geolocation.service.port';
import { PricingService } from '../../services/pricing.service';
import { QuoteReservationUseCase } from '../quote-reservation.use-case';

import { InMemoryPricingRuleRepository } from './doubles/in-memory-pricing-rule.repository';
import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';

const mockGeo: IGeolocationService = {
  getDistanceKm: () => Promise.resolve(10),
};

const makeReservation = (overrides: Partial<Reservation> = {}): Reservation =>
  Reservation.create({
    id: 'res-1',
    clientId: 'user-1',
    origin: 'Origen',
    destination: 'Destino',
    originLat: -34.9,
    originLng: -56.2,
    destinationLat: -34.85,
    destinationLng: -56.15,
    scheduledDate: new Date(Date.now() + 86400000),
    status: ReservationStatus.PENDING_QUOTE,
    totalCost: null,
    costBreakdown: null,
    vehicleId: null,
    conductorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeGood = (): Good =>
  Good.create({
    id: 'good-1',
    reservationId: 'res-1',
    description: 'Monitor',
    value: null,
    size: null,
    quantity: 1,
    categoryId: 'cat-1',
    productId: 'prod-1',
    classificationStrategy: 'preregistered',
    classificationConfidence: 1,
    createdAt: new Date(),
  });

describe('QuoteReservationUseCase', () => {
  let reservationRepo: InMemoryReservationRepository;
  let pricingService: PricingService;
  let useCase: QuoteReservationUseCase;

  beforeEach(async () => {
    reservationRepo = new InMemoryReservationRepository();
    const pricingRepo = new InMemoryPricingRuleRepository();
    pricingService = new PricingService(pricingRepo);
    await pricingService.loadAtBoot();
    useCase = new QuoteReservationUseCase(reservationRepo, pricingService, mockGeo);
  });

  it('cotiza la reserva y actualiza status a QUOTED', async () => {
    await reservationRepo.save(makeReservation(), [makeGood()]);

    const result = await useCase.execute('res-1', [makeGood()]);

    expect(result.status).toBe(ReservationStatus.QUOTED);
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.costBreakdown).not.toBeNull();
  });

  it('lanza ReservationNotFoundError si la reserva no existe', async () => {
    await expect(useCase.execute('no-existe', [makeGood()])).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
  });
});
