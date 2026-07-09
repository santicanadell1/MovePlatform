import { ReservationStatus } from '@move/shared';

import { Reservation } from '../../../domain/entities/reservation.entity';
import { ReservationNotFoundError } from '../../../domain/errors/reservation.errors';
import { CompleteReservationUseCase } from '../complete-reservation.use-case';

import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';

const makeReservation = (status: ReservationStatus): Reservation =>
  Reservation.create({
    id: 'res-1',
    clientId: 'user-1',
    origin: 'Origen',
    destination: 'Destino',
    originLat: -34.9,
    originLng: -56.2,
    destinationLat: -34.88,
    destinationLng: -56.17,
    scheduledDate: new Date('2030-01-01'),
    status,
    totalCost: null,
    costBreakdown: null,
    vehicleId: 'veh-1',
    conductorId: 'cond-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('CompleteReservationUseCase', () => {
  let reservationRepo: InMemoryReservationRepository;
  let useCase: CompleteReservationUseCase;

  beforeEach(() => {
    reservationRepo = new InMemoryReservationRepository();
    useCase = new CompleteReservationUseCase(reservationRepo);
  });

  it('actualiza el status a COMPLETED para una reserva ASSIGNED', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.ASSIGNED), []);

    await useCase.execute({ reservationId: 'res-1' });

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.COMPLETED);
  });

  it('actualiza el status a COMPLETED para una reserva CONFIRMED', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.CONFIRMED), []);

    await useCase.execute({ reservationId: 'res-1' });

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.COMPLETED);
  });

  it('es idempotente: no falla si la reserva ya está COMPLETED', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.COMPLETED), []);

    await expect(useCase.execute({ reservationId: 'res-1' })).resolves.not.toThrow();

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.COMPLETED);
  });

  it('lanza ReservationNotFoundError si la reserva no existe', async () => {
    await expect(useCase.execute({ reservationId: 'nonexistent' })).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
  });
});
