import {
  ConductorNotFoundError,
  InsufficientCapacityError,
  InvalidReservationStatusError,
  ReservationNotFoundError,
  ScheduleConflictError,
  VehicleNotAvailableError,
} from '../../../domain/errors/reservation-assignment.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import { AssignReservationUseCase } from '../operations/assign-reservation.use-case';

import { InMemoryReservationAssignmentRepository } from './doubles/in-memory-reservation-assignment.repository';

const noOpPublisher: IEventPublisher = { publish: () => Promise.resolve() };

// ---------------------------------------------------------------------------
// Base test data
// ---------------------------------------------------------------------------

const RESERVATION_ID = 'r-1';
const VEHICLE_ID = 'v-1';
const CONDUCTOR_ID = 'c-1';

const BASE_RESERVATION = {
  id: RESERVATION_ID,
  status: 'CONFIRMED',
  scheduledDate: new Date('2026-06-01'),
  goods: [],
} as const;

const BASE_VEHICLE = {
  id: VEHICLE_ID,
  capacity: 10,
  available: true,
} as const;

const BASE_CONDUCTOR = {
  id: CONDUCTOR_ID,
  role: 'CONDUCTOR',
  status: 'ACTIVE',
} as const;

// ---------------------------------------------------------------------------
// AssignReservationUseCase
// ---------------------------------------------------------------------------

describe('AssignReservationUseCase', () => {
  let repo: InMemoryReservationAssignmentRepository;
  let useCase: AssignReservationUseCase;

  beforeEach(() => {
    repo = new InMemoryReservationAssignmentRepository();
    useCase = new AssignReservationUseCase(repo, noOpPublisher);

    repo.seedReservation(BASE_RESERVATION);
    repo.seedVehicle(BASE_VEHICLE);
    repo.seedConductor(BASE_CONDUCTOR);
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------

  it('retorna AssignOutput con assignedAt cuando todos los datos son válidos', async () => {
    const result = await useCase.execute({
      reservationId: RESERVATION_ID,
      vehicleId: VEHICLE_ID,
      conductorId: CONDUCTOR_ID,
    });

    expect(result.reservationId).toBe(RESERVATION_ID);
    expect(result.vehicleId).toBe(VEHICLE_ID);
    expect(result.conductorId).toBe(CONDUCTOR_ID);
    expect(result.assignedAt).toBeInstanceOf(Date);
  });

  // -------------------------------------------------------------------------
  // 2. Reserva no encontrada
  // -------------------------------------------------------------------------

  it('lanza ReservationNotFoundError cuando la reserva no existe', async () => {
    await expect(
      useCase.execute({
        reservationId: 'r-does-not-exist',
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });

  // -------------------------------------------------------------------------
  // 3. Estado inválido de la reserva
  // -------------------------------------------------------------------------

  it('lanza InvalidReservationStatusError cuando la reserva está en PENDING_PAYMENT', async () => {
    repo.seedReservation({ ...BASE_RESERVATION, status: 'PENDING_PAYMENT' });

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(InvalidReservationStatusError);
  });

  // -------------------------------------------------------------------------
  // 4. Conductor no encontrado
  // -------------------------------------------------------------------------

  it('lanza ConductorNotFoundError cuando el conductor no existe', async () => {
    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: 'c-does-not-exist',
      }),
    ).rejects.toBeInstanceOf(ConductorNotFoundError);
  });

  // -------------------------------------------------------------------------
  // 5. Conductor con rol incorrecto
  // -------------------------------------------------------------------------

  it('lanza ConductorNotFoundError cuando el conductor tiene role OPERATOR', async () => {
    repo.seedConductor({ id: CONDUCTOR_ID, role: 'OPERATOR', status: 'ACTIVE' });

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(ConductorNotFoundError);
  });

  // -------------------------------------------------------------------------
  // 6. Conductor inactivo
  // -------------------------------------------------------------------------

  it('lanza ConductorNotFoundError cuando el conductor está INACTIVE', async () => {
    repo.seedConductor({ id: CONDUCTOR_ID, role: 'CONDUCTOR', status: 'INACTIVE' });

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(ConductorNotFoundError);
  });

  // -------------------------------------------------------------------------
  // 7. Capacidad insuficiente (4 × LARGE(3) = 12 > capacity 10)
  // -------------------------------------------------------------------------

  it('lanza InsufficientCapacityError cuando los goods superan la capacidad del vehículo', async () => {
    repo.seedReservation({
      ...BASE_RESERVATION,
      goods: [{ size: 'LARGE', quantity: 4 }],
    });

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(InsufficientCapacityError);
  });

  // -------------------------------------------------------------------------
  // 8. Capacidad exacta (no debe lanzar error)
  // -------------------------------------------------------------------------

  it('no lanza error cuando el peso total de goods es exactamente igual a la capacidad', async () => {
    // SMALL=1, MEDIUM=2, LARGE=3, EXTRA_LARGE=4
    // 2 × LARGE(3) + 1 × EXTRA_LARGE(4) = 6+4 = 10
    repo.seedReservation({
      ...BASE_RESERVATION,
      goods: [
        { size: 'LARGE', quantity: 2 },
        { size: 'EXTRA_LARGE', quantity: 1 },
      ],
    });

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 9. Vehículo no disponible (error inyectado via willThrowOnNextAssign)
  // -------------------------------------------------------------------------

  it('lanza VehicleNotAvailableError cuando el vehículo no está disponible al asignar', async () => {
    repo.willThrowOnNextAssign(new VehicleNotAvailableError(VEHICLE_ID));

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(VehicleNotAvailableError);
  });

  // -------------------------------------------------------------------------
  // 10. Conflicto de horario
  // -------------------------------------------------------------------------

  it('lanza ScheduleConflictError cuando hay un conflicto de horario al asignar', async () => {
    repo.willThrowOnNextAssign(new ScheduleConflictError(VEHICLE_ID));

    await expect(
      useCase.execute({
        reservationId: RESERVATION_ID,
        vehicleId: VEHICLE_ID,
        conductorId: CONDUCTOR_ID,
      }),
    ).rejects.toBeInstanceOf(ScheduleConflictError);
  });

  // -------------------------------------------------------------------------
  // 11. Doble booking concurrente
  // -------------------------------------------------------------------------

  it('cuando dos asignaciones concurrentes usan el mismo vehículo, una falla con VehicleNotAvailableError', async () => {
    repo.seedReservation({
      id: 'r-2',
      status: 'CONFIRMED',
      scheduledDate: new Date('2026-06-01'),
      goods: [],
    });

    const [result1, result2] = await Promise.allSettled([
      useCase.execute({ reservationId: 'r-1', vehicleId: VEHICLE_ID, conductorId: CONDUCTOR_ID }),
      useCase.execute({ reservationId: 'r-2', vehicleId: VEHICLE_ID, conductorId: CONDUCTOR_ID }),
    ]);

    const fulfilled = [result1, result2].filter((r) => r.status === 'fulfilled');
    const rejected = [result1, result2].filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0].reason).toBeInstanceOf(VehicleNotAvailableError);
  });

  // -------------------------------------------------------------------------
  // 12. Reserva con status CONFIRMED puede asignarse (bug regression)
  // -------------------------------------------------------------------------

  it('asigna exitosamente cuando la reserva tiene status CONFIRMED', async () => {
    repo.seedReservation({ ...BASE_RESERVATION, status: 'CONFIRMED' });

    const result = await useCase.execute({
      reservationId: RESERVATION_ID,
      vehicleId: VEHICLE_ID,
      conductorId: CONDUCTOR_ID,
    });

    expect(result.reservationId).toBe(RESERVATION_ID);
    expect(result.vehicleId).toBe(VEHICLE_ID);
    expect(result.conductorId).toBe(CONDUCTOR_ID);
    expect(result.assignedAt).toBeInstanceOf(Date);
  });
});
