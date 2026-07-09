import { ClientType, ReservationStatus, UserRole } from '@move/shared';

import { CompanyProduct } from '../../../domain/entities/company-product.entity';
import { User } from '../../../domain/entities/user.entity';
import {
  EmptyGoodsError,
  InvalidReservationDateError,
  ProductNotPreregisteredError,
} from '../../../domain/errors/reservation.errors';
import type { IGeolocationService } from '../../../domain/ports/geolocation.service.port';
import { PricingService } from '../../services/pricing.service';
import { CreateEmpresaReservationUseCase } from '../create-empresa-reservation.use-case';
import { QuoteReservationUseCase } from '../quote-reservation.use-case';

import { InMemoryCompanyProductRepository } from './doubles/in-memory-company-product.repository';
import { InMemoryPricingRuleRepository } from './doubles/in-memory-pricing-rule.repository';
import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';
import { FakeTopClientsCache } from './doubles/fake-top-clients-cache';

const mockGeo: IGeolocationService = { getDistanceKm: () => Promise.resolve(10) };

const FUTURE_DATE = new Date(Date.now() + 86400000);
const PAST_DATE = new Date(Date.now() - 86400000);

const makeUser = (): User =>
  new User({
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    role: UserRole.CLIENT_EMPRESA,
    type: ClientType.EMPRESA,
    name: 'Empresa SA',
    email: 'empresa@test.com',
    companyName: 'Empresa SA',
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeProduct = (overrides: Partial<CompanyProduct> = {}): CompanyProduct =>
  CompanyProduct.create({
    id: 'prod-1',
    clientId: 'user-1',
    name: 'Monitor',
    categoryId: 'cat-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeInput = (overrides = {}) => ({
  firebaseUid: 'firebase-uid-1',
  origin: 'Av. Italia 100',
  destination: 'Bvar. Artigas 500',
  originLat: -34.9,
  originLng: -56.2,
  destinationLat: -34.85,
  destinationLng: -56.15,
  scheduledDate: FUTURE_DATE,
  goods: [{ productId: 'prod-1', quantity: 1 }],
  ...overrides,
});

describe('CreateEmpresaReservationUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let reservationRepo: InMemoryReservationRepository;
  let productRepo: InMemoryCompanyProductRepository;
  let fakeCache: FakeTopClientsCache;
  let useCase: CreateEmpresaReservationUseCase;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    reservationRepo = new InMemoryReservationRepository();
    productRepo = new InMemoryCompanyProductRepository();
    fakeCache = new FakeTopClientsCache();

    const pricingRepo = new InMemoryPricingRuleRepository();
    const pricingService = new PricingService(pricingRepo);
    await pricingService.loadAtBoot();

    const quoteUseCase = new QuoteReservationUseCase(reservationRepo, pricingService, mockGeo);
    useCase = new CreateEmpresaReservationUseCase(
      userRepo,
      reservationRepo,
      productRepo,
      quoteUseCase,
      fakeCache,
    );

    await userRepo.save(makeUser());
    productRepo.seed([makeProduct()]);
  });

  it('crea la reserva y la retorna en estado QUOTED', async () => {
    const result = await useCase.execute(makeInput());

    expect(result.status).toBe(ReservationStatus.QUOTED);
    expect(result.clientId).toBe('user-1');
    expect(result.totalCost).toBeGreaterThan(0);
    expect(result.costBreakdown).not.toBeNull();
  });

  it('lanza InvalidReservationDateError si la fecha es pasada', async () => {
    await expect(useCase.execute(makeInput({ scheduledDate: PAST_DATE }))).rejects.toBeInstanceOf(
      InvalidReservationDateError,
    );
  });

  it('lanza EmptyGoodsError si no hay bienes', async () => {
    await expect(useCase.execute(makeInput({ goods: [] }))).rejects.toBeInstanceOf(EmptyGoodsError);
  });

  it('lanza ProductNotPreregisteredError si el productId no existe', async () => {
    await expect(
      useCase.execute(makeInput({ goods: [{ productId: 'no-existe', quantity: 1 }] })),
    ).rejects.toBeInstanceOf(ProductNotPreregisteredError);
  });

  it('lanza ProductNotPreregisteredError si el producto pertenece a otro cliente', async () => {
    productRepo.seed([makeProduct({ clientId: 'otro-user' })]);

    await expect(useCase.execute(makeInput())).rejects.toBeInstanceOf(ProductNotPreregisteredError);
  });

  it('asigna el categoryId del producto a cada bien', async () => {
    await useCase.execute(makeInput());
    const saved = reservationRepo.getGoods(
      [...(await reservationRepo.findByClientId('user-1'))][0].id,
    );

    expect(saved[0].categoryId).toBe('cat-1');
    expect(saved[0].productId).toBe('prod-1');
  });

  describe('cache integration', () => {
    it('HIT: usa productos de cache y no llama a productRepo.findByClientId', async () => {
      fakeCache.behavior = 'hit';
      fakeCache.products = [makeProduct()];
      const findByClientIdSpy = jest.spyOn(productRepo, 'findByClientId');

      const result = await useCase.execute(makeInput());

      expect(result.status).toBe(ReservationStatus.QUOTED);
      expect(findByClientIdSpy).not.toHaveBeenCalled();
    });

    it('MISS: llama a productRepo.findByClientId cuando cache retorna null', async () => {
      fakeCache.behavior = 'miss';
      const findByClientIdSpy = jest.spyOn(productRepo, 'findByClientId');

      const result = await useCase.execute(makeInput());

      expect(result.status).toBe(ReservationStatus.QUOTED);
      expect(findByClientIdSpy).toHaveBeenCalledWith('user-1');
    });

    it('ERROR Redis: fallback transparente a DB sin propagar el error', async () => {
      fakeCache.behavior = 'throw';
      const findByClientIdSpy = jest.spyOn(productRepo, 'findByClientId');

      const result = await useCase.execute(makeInput());

      expect(result.status).toBe(ReservationStatus.QUOTED);
      expect(findByClientIdSpy).toHaveBeenCalledWith('user-1');
    });
  });
});
