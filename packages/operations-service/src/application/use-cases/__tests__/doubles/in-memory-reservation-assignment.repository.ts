import { VehicleNotAvailableError } from '../../../../domain/errors/reservation-assignment.errors';
import type {
  AssignInput,
  AssignOutput,
  ConductorData,
  IReservationAssignmentRepository,
  ReservationData,
  VehicleData,
} from '../../../../domain/ports/reservation-assignment.repository.port';

export class InMemoryReservationAssignmentRepository implements IReservationAssignmentRepository {
  private reservations: Map<string, ReservationData> = new Map();
  private vehicles: Map<string, VehicleData> = new Map();
  private conductors: Map<string, ConductorData> = new Map();
  private nextAssignError: Error | null = null;

  seedReservation(data: ReservationData): void {
    this.reservations.set(data.id, data);
  }

  seedVehicle(data: VehicleData): void {
    this.vehicles.set(data.id, data);
  }

  seedConductor(data: ConductorData): void {
    this.conductors.set(data.id, data);
  }

  willThrowOnNextAssign(err: Error): void {
    this.nextAssignError = err;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findReservation(id: string): Promise<ReservationData | null> {
    return this.reservations.get(id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findConductor(id: string): Promise<ConductorData | null> {
    return this.conductors.get(id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findVehicle(id: string): Promise<VehicleData | null> {
    return this.vehicles.get(id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async assignWithLock(input: AssignInput): Promise<AssignOutput> {
    if (this.nextAssignError !== null) {
      const err = this.nextAssignError;
      this.nextAssignError = null;
      throw err;
    }

    const vehicle = this.vehicles.get(input.vehicleId);
    if (vehicle && !vehicle.available) {
      throw new VehicleNotAvailableError(input.vehicleId);
    }

    if (vehicle) {
      this.vehicles.set(input.vehicleId, { ...vehicle, available: false });
    }

    return {
      reservationId: input.reservationId,
      vehicleId: input.vehicleId,
      conductorId: input.conductorId,
      assignedAt: new Date(),
    };
  }
}
