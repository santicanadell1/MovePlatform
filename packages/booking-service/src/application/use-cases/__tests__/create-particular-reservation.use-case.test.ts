import { ClientType, GoodSize, ReservationStatus, UserRole } from '@move/shared';

import { User } from '../../../domain/entities/user.entity';
import {
  InvalidReservationDateError,
  EmptyGoodsError,
} from '../../../domain/errors/reservation.errors';
import type {
  ICategorizador,
  ClassificationResult,
} from '../../../domain/ports/categorizador.port';
import { ClassificationCascadeService } from '../../services/classification-cascade.service';
import type { IGeolocationService } from '../../../domain/ports/geolocation.service.port';
import { PricingService } from '../../services/pricing.service';
import { CreateParticularReservationUseCase } from '../create-particular-reservation.use-case';
import { QuoteReservationUseCase } from '../quote-reservation.use-case';

import { FakeEventPublisher } from './doubles/fake-event-publisher';
import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';
import { InMemoryPricingRuleRepository } from './doubles/in-memory-pricing-rule.repository';

interface JobQueueMock {
  enqueue: jest.Mock;
}

interface SseNotifierMock {
  notify: jest.Mock;
}

const mockGeo: IGeolocationService = { getDistanceKm: () => Promise.resolve(10) };

const FUTURE_DATE = new Date(Date.now() + 86_400_000);
const PAST_DATE = new Date(Date.now() - 86_400_000);

const makeUser = () =>
  new User({
    id: 'user-1',
    firebaseUid: 'uid-1',
    role: UserRole.CLIENT_PARTICULAR,
    type: ClientType.PARTICULAR,
    name: 'Test User',
    email: 'test@move.uy',
    companyName: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeInput = (overrides = {}) => ({
  firebaseUid: 'uid-1',
  origin: 'Av. 18 de Julio 1000',
  destination: 'Av. Brasil 2500',
  originLat: -34.9,
  originLng: -56.2,
  destinationLat: -34.88,
  destinationLng: -56.17,
  scheduledDate: FUTURE_DATE,
  goods: [{ description: 'traslado de muebles de sala', size: GoodSize.MEDIUM, quantity: 1 }],
  ...overrides,
});

const makeCategorizador = (result: ClassificationResult | null): ICategorizador => ({
  strategy: 'rule-based',
  isAsync: false,
  classify: jest.fn().mockResolvedValue(result),
});

describe('CreateParticularReservationUseCase (2.1)', () => {
  let userRepo: InMemoryUserRepository;
  let reservationRepo: InMemoryReservationRepository;
  let eventPublisher: FakeEventPublisher;
  let quoteUseCase: QuoteReservationUseCase;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    reservationRepo = new InMemoryReservationRepository();
    eventPublisher = new FakeEventPublisher();
    const pricingRepo = new InMemoryPricingRuleRepository();
    const pricingService = new PricingService(pricingRepo);
    await pricingService.loadAtBoot();
    quoteUseCase = new QuoteReservationUseCase(reservationRepo, pricingService, mockGeo);
    await userRepo.save(makeUser());
  });

  const makeJobQueue = (): JobQueueMock => ({
    enqueue: jest.fn().mockResolvedValue(undefined),
  });

  const makeSseNotifier = (): SseNotifierMock => ({
    notify: jest.fn().mockResolvedValue(undefined),
  });

  const makeUseCase = (
    categorizador: ICategorizador | null,
    jobQueue?: JobQueueMock,
    sseNotifier?: SseNotifierMock,
  ) => {
    const cascade = new ClassificationCascadeService(categorizador ? [categorizador] : []);
    return new CreateParticularReservationUseCase(
      userRepo,
      reservationRepo,
      quoteUseCase,
      cascade,
      eventPublisher,
      jobQueue ?? makeJobQueue(),
      sseNotifier ?? makeSseNotifier(),
    );
  };

  it('clasifica sync → retorna reserva en estado QUOTED', async () => {
    const cat = makeCategorizador({ categoryId: 'cat-1', confidence: 0.9, strategy: 'rule-based' });
    const result = await makeUseCase(cat).execute(makeInput());

    expect(result.status).toBe(ReservationStatus.QUOTED);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it('cascade sin match → retorna PENDING_CLASSIFICATION y publica evento', async () => {
    const cat = makeCategorizador(null);
    const result = await makeUseCase(cat).execute(makeInput());

    expect(result.status).toBe(ReservationStatus.PENDING_CLASSIFICATION);
    expect(eventPublisher.published).toHaveLength(1);
    expect(eventPublisher.published[0]?.routingKey).toBe('reservation.unclassified');
  });

  it('sin categorizadores → PENDING_CLASSIFICATION y publica evento', async () => {
    const result = await makeUseCase(null).execute(makeInput());

    expect(result.status).toBe(ReservationStatus.PENDING_CLASSIFICATION);
    expect(eventPublisher.published).toHaveLength(1);
  });

  it('lanza InvalidReservationDateError si la fecha es pasada', async () => {
    const cat = makeCategorizador(null);
    await expect(
      makeUseCase(cat).execute(makeInput({ scheduledDate: PAST_DATE })),
    ).rejects.toBeInstanceOf(InvalidReservationDateError);
  });

  it('lanza EmptyGoodsError si no hay bienes', async () => {
    const cat = makeCategorizador(null);
    await expect(makeUseCase(cat).execute(makeInput({ goods: [] }))).rejects.toBeInstanceOf(
      EmptyGoodsError,
    );
  });

  it('lanza error si el bien no tiene descripción', async () => {
    const cat = makeCategorizador(null);
    await expect(
      makeUseCase(cat).execute(makeInput({ goods: [{ size: GoodSize.SMALL, quantity: 1 }] })),
    ).rejects.toThrow();
  });

  it('persiste la reserva con el categoryId del cascade', async () => {
    const cat = makeCategorizador({
      categoryId: 'cat-mudanza',
      confidence: 0.8,
      strategy: 'rule-based',
    });
    const result = await makeUseCase(cat).execute(makeInput());

    const saved = await reservationRepo.findById(result.id);
    expect(saved).not.toBeNull();
  });

  it('encola job ai:categorization cuando el cascade no clasifica', async () => {
    const cat = makeCategorizador(null);
    const jobQueue = makeJobQueue();
    await makeUseCase(cat, jobQueue).execute(makeInput());

    expect(jobQueue.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: expect.any(String) as string,
        goodDescription: expect.any(String) as string,
        categories: expect.any(Array) as Array<{ id: string; name: string }>,
      }),
    );
  });

  it('no encola job cuando todos los goods se clasifican', async () => {
    const cat = makeCategorizador({ categoryId: 'cat-1', confidence: 0.9, strategy: 'rule-based' });
    const jobQueue = makeJobQueue();
    await makeUseCase(cat, jobQueue).execute(makeInput());

    expect(jobQueue.enqueue).not.toHaveBeenCalled();
  });

  it('llama sseNotifier.notify cuando el cascade no clasifica', async () => {
    const cat = makeCategorizador(null);
    const sseNotifier = makeSseNotifier();
    await makeUseCase(cat, undefined, sseNotifier).execute(makeInput());

    expect(sseNotifier.notify).toHaveBeenCalledTimes(1);
    expect(sseNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: expect.any(String) as string,
        goodDescription: expect.any(String) as string,
        clientEmail: expect.any(String) as string,
      }),
    );
  });

  it('no llama sseNotifier.notify cuando el cascade clasifica', async () => {
    const cat = makeCategorizador({ categoryId: 'cat-1', confidence: 0.9, strategy: 'rule-based' });
    const sseNotifier = makeSseNotifier();
    await makeUseCase(cat, undefined, sseNotifier).execute(makeInput());

    expect(sseNotifier.notify).not.toHaveBeenCalled();
  });
});
