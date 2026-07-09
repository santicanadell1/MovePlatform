import { ClientType, ReservationStatus, UserRole } from '@move/shared';

import { Reservation } from '../../../domain/entities/reservation.entity';
import { User } from '../../../domain/entities/user.entity';
import { GetReservationsUseCase } from '../get-reservations.use-case';

import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

const makeUser = (
  overrides: Partial<{ id: string; firebaseUid: string; role: UserRole }> = {},
): User =>
  new User({
    id: overrides.id ?? 'user-1',
    firebaseUid: overrides.firebaseUid ?? 'firebase-1',
    role: overrides.role ?? UserRole.CLIENT_EMPRESA,
    type: ClientType.EMPRESA,
    name: 'Test User',
    email: 'test@test.com',
    companyName: null,
    phone: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });

const makeReservation = (
  overrides: Partial<{
    id: string;
    clientId: string;
    status: ReservationStatus;
    scheduledDate: Date;
    createdAt: Date;
  }> = {},
): Reservation =>
  Reservation.create({
    id: overrides.id ?? 'res-1',
    clientId: overrides.clientId ?? 'user-1',
    origin: 'Origen',
    destination: 'Destino',
    originLat: -34.9,
    originLng: -56.2,
    destinationLat: -34.85,
    destinationLng: -56.15,
    scheduledDate: overrides.scheduledDate ?? new Date('2026-06-01'),
    status: overrides.status ?? ReservationStatus.QUOTED,
    totalCost: 500,
    costBreakdown: null,
    vehicleId: null,
    conductorId: null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  });

describe('GetReservationsUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let reservationRepo: InMemoryReservationRepository;
  let useCase: GetReservationsUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    reservationRepo = new InMemoryReservationRepository();
    useCase = new GetReservationsUseCase(userRepo, reservationRepo);
  });

  it('CLIENT_EMPRESA ve solo sus propias reservas', async () => {
    const user1 = makeUser({ id: 'user-1', firebaseUid: 'firebase-1' });
    const user2 = makeUser({ id: 'user-2', firebaseUid: 'firebase-2' });
    await userRepo.save(user1);
    await userRepo.save(user2);

    const res1 = makeReservation({ id: 'res-1', clientId: 'user-1' });
    const res2 = makeReservation({ id: 'res-2', clientId: 'user-2' });
    await reservationRepo.save(res1, []);
    await reservationRepo.save(res2, []);

    const result = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      limit: 20,
    });

    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]?.id).toBe('res-1');
  });

  it('OPERATOR ve todas las reservas sin filtro de cliente', async () => {
    const user1 = makeUser({ id: 'user-1', firebaseUid: 'firebase-1' });
    const user2 = makeUser({ id: 'user-2', firebaseUid: 'firebase-2' });
    await userRepo.save(user1);
    await userRepo.save(user2);

    await reservationRepo.save(makeReservation({ id: 'res-1', clientId: 'user-1' }), []);
    await reservationRepo.save(makeReservation({ id: 'res-2', clientId: 'user-2' }), []);

    const result = await useCase.execute({
      firebaseUid: 'operator-uid',
      role: UserRole.OPERATOR,
      limit: 20,
    });

    expect(result.reservations).toHaveLength(2);
  });

  it('filtra por status correctamente', async () => {
    const user = makeUser();
    await userRepo.save(user);

    await reservationRepo.save(
      makeReservation({ id: 'res-1', status: ReservationStatus.QUOTED }),
      [],
    );
    await reservationRepo.save(
      makeReservation({ id: 'res-2', status: ReservationStatus.CONFIRMED }),
      [],
    );

    const result = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      status: ReservationStatus.QUOTED,
      limit: 20,
    });

    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]?.status).toBe(ReservationStatus.QUOTED);
  });

  it('filtra por dateFrom y dateTo correctamente', async () => {
    const user = makeUser();
    await userRepo.save(user);

    await reservationRepo.save(
      makeReservation({ id: 'res-1', scheduledDate: new Date('2026-06-10') }),
      [],
    );
    await reservationRepo.save(
      makeReservation({ id: 'res-2', scheduledDate: new Date('2026-07-01') }),
      [],
    );

    const result = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      dateFrom: new Date('2026-06-01'),
      dateTo: new Date('2026-06-30'),
      limit: 20,
    });

    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]?.id).toBe('res-1');
  });

  it('paginación: nextCursor permite obtener segunda página sin duplicados', async () => {
    await userRepo.save(makeUser());

    await reservationRepo.save(
      makeReservation({ id: 'res-1', createdAt: new Date('2026-01-01') }),
      [],
    );
    await reservationRepo.save(
      makeReservation({ id: 'res-2', createdAt: new Date('2026-01-02') }),
      [],
    );
    await reservationRepo.save(
      makeReservation({ id: 'res-3', createdAt: new Date('2026-01-03') }),
      [],
    );

    const page1 = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      limit: 2,
    });

    expect(page1.reservations).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      limit: 2,
      cursor: page1.nextCursor,
    });

    expect(page2.reservations).toHaveLength(1);
    const allIds = [...page1.reservations.map((r) => r.id), ...page2.reservations.map((r) => r.id)];
    expect(new Set(allIds).size).toBe(3);
  });

  it('retorna lista vacía cuando no hay reservas que coincidan', async () => {
    await userRepo.save(makeUser());

    const result = await useCase.execute({
      firebaseUid: 'firebase-1',
      role: UserRole.CLIENT_EMPRESA,
      status: ReservationStatus.CONFIRMED,
      limit: 20,
    });

    expect(result.reservations).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });
});
