import {
  GoodSize,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  ReservationStatus,
} from '@move/shared';

import { Good } from '../../../domain/entities/good.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import { ClassifyReservationUseCase } from '../classify-reservation.use-case';

import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';

interface CategoryRepoMock {
  findById: jest.Mock;
  findAllForAi: jest.Mock;
}

interface ResumeUseCaseMock {
  execute: jest.Mock;
}

interface PublisherMock {
  publish: jest.Mock;
}

const makeReservation = (status = ReservationStatus.PENDING_CLASSIFICATION) =>
  Reservation.create({
    id: 'res-1',
    clientId: 'client-1',
    origin: 'Origen',
    destination: 'Destino',
    originLat: -34.9,
    originLng: -56.2,
    destinationLat: -34.88,
    destinationLng: -56.17,
    scheduledDate: new Date(Date.now() + 86_400_000),
    status,
    totalCost: null,
    costBreakdown: null,
    vehicleId: null,
    conductorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeGood = () =>
  Good.create({
    id: 'good-1',
    reservationId: 'res-1',
    description: 'televisor samsung',
    value: null,
    size: GoodSize.MEDIUM,
    quantity: 1,
    categoryId: null,
    productId: null,
    classificationStrategy: null,
    classificationConfidence: null,
    createdAt: new Date(),
  });

describe('ClassifyReservationUseCase', () => {
  let reservationRepo: InMemoryReservationRepository;
  let categoryRepo: CategoryRepoMock;
  let resumeUseCase: ResumeUseCaseMock;
  let publisher: PublisherMock;

  beforeEach(() => {
    reservationRepo = new InMemoryReservationRepository();
    categoryRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Electrónica' }),
      findAllForAi: jest.fn().mockResolvedValue([]),
    };
    resumeUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
  });

  const makeUseCase = () =>
    new ClassifyReservationUseCase(
      reservationRepo,
      categoryRepo,
      resumeUseCase as never,
      publisher,
    );

  it('lanza ReservationNotFoundError si la reserva no existe', async () => {
    const { ReservationNotFoundError } = await import('../../../domain/errors/reservation.errors');
    await expect(
      makeUseCase().execute({ reservationId: 'no-existe', categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });

  it('lanza ReservationNotPendingClassificationError si la reserva no está en PENDING_CLASSIFICATION', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.QUOTED), [makeGood()]);
    const { ReservationNotPendingClassificationError } =
      await import('../../../domain/errors/category.errors');
    await expect(
      makeUseCase().execute({ reservationId: 'res-1', categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(ReservationNotPendingClassificationError);
  });

  it('lanza CategoryNotFoundError si el categoryId no existe', async () => {
    await reservationRepo.save(makeReservation(), [makeGood()]);
    categoryRepo.findById.mockResolvedValue(null);
    const { CategoryNotFoundError } = await import('../../../domain/errors/category.errors');
    await expect(
      makeUseCase().execute({ reservationId: 'res-1', categoryId: 'cat-inexistente' }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('llama resumeUseCase.execute con los datos correctos', async () => {
    await reservationRepo.save(makeReservation(), [makeGood()]);

    await makeUseCase().execute({ reservationId: 'res-1', categoryId: 'cat-1' });

    expect(resumeUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res-1',
        categoryId: 'cat-1',
        categoryName: 'Electrónica',
      }),
    );
  });

  it('publica reservation.classified a RabbitMQ', async () => {
    await reservationRepo.save(makeReservation(), [makeGood()]);

    await makeUseCase().execute({ reservationId: 'res-1', categoryId: 'cat-1' });

    expect(publisher.publish).toHaveBeenCalledWith(
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.RESERVATION_CLASSIFIED,
      expect.objectContaining({ reservationId: 'res-1', categoryId: 'cat-1' }),
    );
  });

  it('retorna { reservationId, status: QUOTED }', async () => {
    await reservationRepo.save(makeReservation(), [makeGood()]);

    const result = await makeUseCase().execute({ reservationId: 'res-1', categoryId: 'cat-1' });

    expect(result).toEqual({ reservationId: 'res-1', status: ReservationStatus.QUOTED });
  });
});
