import { ClientType, PaymentStatus, ReservationStatus, UserRole } from '@move/shared';

import { Payment } from '../../../domain/entities/payment.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { User } from '../../../domain/entities/user.entity';
import {
  PaymentAlreadyExistsError,
  PaymentGatewayUnavailableError,
  ReservationNotFoundError,
  ReservationNotQuotedError,
  ReservationOwnershipError,
} from '../../../domain/errors/reservation.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import { PayReservationUseCase } from '../pay-reservation.use-case';

import { FakePaymentGateway } from './doubles/fake-payment-gateway';
import { InMemoryPaymentRepository } from './doubles/in-memory-payment.repository';
import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

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
    status: ReservationStatus.QUOTED,
    totalCost: 500,
    costBreakdown: null,
    vehicleId: null,
    conductorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('PayReservationUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let reservationRepo: InMemoryReservationRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let gateway: FakePaymentGateway;
  let useCase: PayReservationUseCase;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    reservationRepo = new InMemoryReservationRepository();
    paymentRepo = new InMemoryPaymentRepository();
    gateway = new FakePaymentGateway();
    const noOpPublisher: IEventPublisher = { publish: () => Promise.resolve() };
    useCase = new PayReservationUseCase(
      reservationRepo,
      paymentRepo,
      gateway,
      userRepo,
      noOpPublisher,
    );

    await userRepo.save(makeUser());
    await reservationRepo.save(makeReservation(), []);
  });

  it('pago exitoso: reserva QUOTED -> CONFIRMED, payment APPROVED', async () => {
    const payment = await useCase.execute({
      reservationId: 'res-1',
      firebaseUid: 'firebase-uid-1',
    });

    expect(payment.status).toBe(PaymentStatus.APPROVED);
    expect(payment.providerTransactionId).toBe('txn-mock-123');
    expect(payment.amount).toBe(500);
    expect(payment.reservationId).toBe('res-1');

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.CONFIRMED);
  });

  it('gateway rechaza: reserva -> REJECTED, payment REJECTED con errorMessage', async () => {
    gateway.behavior = 'reject';

    const payment = await useCase.execute({
      reservationId: 'res-1',
      firebaseUid: 'firebase-uid-1',
    });

    expect(payment.status).toBe(PaymentStatus.REJECTED);
    expect(payment.errorMessage).toBe('Fondos insuficientes');

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.REJECTED);
  });

  it('circuit breaker abierto: reserva -> PENDING_PAYMENT, no se crea payment, lanza PaymentGatewayUnavailableError', async () => {
    gateway.behavior = 'throw';

    await expect(
      useCase.execute({ reservationId: 'res-1', firebaseUid: 'firebase-uid-1' }),
    ).rejects.toBeInstanceOf(PaymentGatewayUnavailableError);

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.PENDING_PAYMENT);

    const payment = await paymentRepo.findByReservationId('res-1');
    expect(payment).toBeNull();
  });

  it('lanza ReservationNotQuotedError si la reserva no está en QUOTED', async () => {
    await reservationRepo.save(
      makeReservation({ id: 'res-2', status: ReservationStatus.PENDING_QUOTE }),
      [],
    );

    await expect(
      useCase.execute({ reservationId: 'res-2', firebaseUid: 'firebase-uid-1' }),
    ).rejects.toBeInstanceOf(ReservationNotQuotedError);
  });

  it('lanza ReservationNotFoundError si la reserva no existe', async () => {
    await expect(
      useCase.execute({ reservationId: 'no-existe', firebaseUid: 'firebase-uid-1' }),
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });

  it('lanza ReservationOwnershipError si el usuario no es dueño', async () => {
    await reservationRepo.save(makeReservation({ id: 'res-3', clientId: 'otro-user' }), []);

    await expect(
      useCase.execute({ reservationId: 'res-3', firebaseUid: 'firebase-uid-1' }),
    ).rejects.toBeInstanceOf(ReservationOwnershipError);
  });

  it('lanza PaymentAlreadyExistsError si ya existe un pago para la reserva', async () => {
    await paymentRepo.save(
      Payment.create({
        id: 'pay-existing',
        reservationId: 'res-1',
        amount: 500,
        currency: 'UYU',
        status: PaymentStatus.APPROVED,
        provider: 'mock',
        providerTransactionId: 'txn-old',
        attemptedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
        createdAt: new Date(),
      }),
    );

    await expect(
      useCase.execute({ reservationId: 'res-1', firebaseUid: 'firebase-uid-1' }),
    ).rejects.toBeInstanceOf(PaymentAlreadyExistsError);
  });
});
