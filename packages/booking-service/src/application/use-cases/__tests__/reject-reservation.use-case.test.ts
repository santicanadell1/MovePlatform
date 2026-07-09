import { ClientType, ReservationStatus, UserRole } from '@move/shared';

import { Reservation } from '../../../domain/entities/reservation.entity';
import { User } from '../../../domain/entities/user.entity';
import { ReservationNotPendingClassificationError } from '../../../domain/errors/category.errors';
import { ReservationNotFoundError } from '../../../domain/errors/reservation.errors';
import type {
  IEmailService,
  RejectionEmailRequest,
} from '../../../domain/ports/email.service.port';
import { RejectReservationUseCase } from '../reject-reservation.use-case';

import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

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
    vehicleId: null,
    conductorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeUser = (): User =>
  new User({
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    role: UserRole.CLIENT_PARTICULAR,
    type: ClientType.PARTICULAR,
    name: 'Juan Pérez',
    email: 'juan@example.com',
    companyName: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

describe('RejectReservationUseCase', () => {
  let reservationRepo: InMemoryReservationRepository;
  let userRepo: InMemoryUserRepository;
  let emailService: jest.Mocked<IEmailService>;
  let useCase: RejectReservationUseCase;

  beforeEach(() => {
    reservationRepo = new InMemoryReservationRepository();
    userRepo = new InMemoryUserRepository();
    emailService = {
      sendRejection: jest.fn<Promise<void>, [RejectionEmailRequest]>().mockResolvedValue(undefined),
    };
    useCase = new RejectReservationUseCase(reservationRepo, userRepo, emailService);
  });

  it('rechaza reserva PENDING_CLASSIFICATION y retorna con status REJECTED', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.PENDING_CLASSIFICATION), []);
    userRepo['users'].push(makeUser());

    const result = await useCase.execute({ reservationId: 'res-1' });

    expect(result.status).toBe(ReservationStatus.REJECTED);
  });

  it('persiste el estado REJECTED en el repositorio', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.PENDING_CLASSIFICATION), []);
    userRepo['users'].push(makeUser());

    await useCase.execute({ reservationId: 'res-1' });

    const updated = await reservationRepo.findById('res-1');
    expect(updated?.status).toBe(ReservationStatus.REJECTED);
  });

  it('llama a emailService.sendRejection con datos del cliente', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.PENDING_CLASSIFICATION), []);
    userRepo['users'].push(makeUser());

    await useCase.execute({ reservationId: 'res-1' });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.sendRejection).toHaveBeenCalledWith(
      expect.objectContaining<Partial<RejectionEmailRequest>>({
        to: 'juan@example.com',
        clientName: 'Juan Pérez',
        reservationId: 'res-1',
      }),
    );
  });

  it('lanza ReservationNotFoundError si la reserva no existe', async () => {
    await expect(useCase.execute({ reservationId: 'nonexistent' })).rejects.toBeInstanceOf(
      ReservationNotFoundError,
    );
  });

  it('lanza ReservationNotPendingClassificationError si status != PENDING_CLASSIFICATION', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.CONFIRMED), []);

    await expect(useCase.execute({ reservationId: 'res-1' })).rejects.toBeInstanceOf(
      ReservationNotPendingClassificationError,
    );
  });

  it('no falla y no envía email si el cliente no se encuentra', async () => {
    await reservationRepo.save(makeReservation(ReservationStatus.PENDING_CLASSIFICATION), []);
    // no se agrega usuario al repo

    const result = await useCase.execute({ reservationId: 'res-1' });

    expect(result.status).toBe(ReservationStatus.REJECTED);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(emailService.sendRejection).not.toHaveBeenCalled();
  });
});
