import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  type ReservationAssignedEvent,
} from '@move/shared';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';

import {
  ConductorNotFoundError,
  InsufficientCapacityError,
  InvalidReservationStatusError,
  ReservationNotFoundError,
  VehicleNotAvailableError,
} from '../../../domain/errors/reservation-assignment.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import type {
  AssignOutput,
  IReservationAssignmentRepository,
} from '../../../domain/ports/reservation-assignment.repository.port';
import { TYPES } from '../../../types';

export interface AssignReservationInput {
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
}

const SIZE_WEIGHTS: Record<string, number> = {
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
  EXTRA_LARGE: 4,
};

@injectable()
export class AssignReservationUseCase {
  constructor(
    @inject(TYPES.ReservationAssignmentRepository)
    private readonly repo: IReservationAssignmentRepository,
    @inject(TYPES.EventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: AssignReservationInput): Promise<AssignOutput> {
    const { reservationId, vehicleId, conductorId } = input;

    // 1. Find reservation
    const reservation = await this.repo.findReservation(reservationId);
    if (reservation === null) {
      throw new ReservationNotFoundError(reservationId);
    }

    // 2. Validate reservation status
    if (reservation.status !== 'CONFIRMED') {
      throw new InvalidReservationStatusError(reservationId, reservation.status);
    }

    // 3. Find conductor
    const conductor = await this.repo.findConductor(conductorId);
    if (conductor === null) {
      throw new ConductorNotFoundError(conductorId);
    }

    // 4. Validate conductor role and status
    if (conductor.role !== 'CONDUCTOR' || conductor.status !== 'ACTIVE') {
      throw new ConductorNotFoundError(conductorId);
    }

    // 5. Find vehicle
    const vehicle = await this.repo.findVehicle(vehicleId);
    if (vehicle === null) {
      throw new VehicleNotAvailableError(vehicleId);
    }

    // 6. Check capacity
    const totalWeight = reservation.goods.reduce(
      (sum, g) => sum + (SIZE_WEIGHTS[g.size ?? ''] ?? 1) * g.quantity,
      0,
    );
    if (vehicle.capacity < totalWeight) {
      throw new InsufficientCapacityError(vehicleId, totalWeight, vehicle.capacity);
    }

    // 7. Assign with lock — let VehicleNotAvailableError and ScheduleConflictError propagate
    const result = await this.repo.assignWithLock({ reservationId, vehicleId, conductorId });

    // 8. Publicar para que booking actualice su estado a ASSIGNED
    const event: ReservationAssignedEvent = {
      eventId: uuidv4(),
      occurredAt: result.assignedAt.toISOString(),
      reservationId: result.reservationId,
      vehicleId: result.vehicleId,
      conductorId: result.conductorId,
      assignedAt: result.assignedAt.toISOString(),
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.RESERVATION_ASSIGNED,
        event,
      );
    } catch {
      // Vehículo ya asignado en operations; booking se sincroniza por eventual consistency.
    }

    return result;
  }
}
