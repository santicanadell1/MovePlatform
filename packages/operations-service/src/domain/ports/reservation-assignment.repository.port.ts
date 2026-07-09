// GoodSize debe coincidir con el enum del booking-service
export type GoodSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';

export interface GoodData {
  readonly size: GoodSize | null;
  readonly quantity: number;
}

export interface ReservationData {
  readonly id: string;
  readonly status: string;
  readonly scheduledDate: Date;
  readonly goods: readonly GoodData[];
}

export interface ConductorData {
  readonly id: string;
  readonly role: string;
  readonly status: string;
}

export interface VehicleData {
  readonly id: string;
  readonly capacity: number;
  readonly available: boolean;
}

export interface AssignInput {
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
}

export interface AssignOutput {
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
  readonly assignedAt: Date;
}

export interface IReservationAssignmentRepository {
  findReservation(id: string): Promise<ReservationData | null>;
  findConductor(id: string): Promise<ConductorData | null>;
  findVehicle(id: string): Promise<VehicleData | null>;
  assignWithLock(input: AssignInput): Promise<AssignOutput>;
}
