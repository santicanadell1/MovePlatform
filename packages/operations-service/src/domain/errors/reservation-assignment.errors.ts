export class ReservationNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Reserva no encontrada: ${reservationId}`);
    this.name = 'ReservationNotFoundError';
  }
}

export class InvalidReservationStatusError extends Error {
  constructor(reservationId: string, currentStatus: string) {
    super(`La reserva ${reservationId} tiene un estado inválido para asignación: ${currentStatus}`);
    this.name = 'InvalidReservationStatusError';
  }
}

export class VehicleNotAvailableError extends Error {
  constructor(vehicleId: string) {
    super(`El vehículo no está disponible: ${vehicleId}`);
    this.name = 'VehicleNotAvailableError';
  }
}

export class ScheduleConflictError extends Error {
  constructor(vehicleId: string) {
    super(`El vehículo tiene un conflicto de horario: ${vehicleId}`);
    this.name = 'ScheduleConflictError';
  }
}

export class InsufficientCapacityError extends Error {
  constructor(vehicleId: string, required: number, available: number) {
    super(
      `El vehículo ${vehicleId} no tiene capacidad suficiente: requerida ${required}, disponible ${available}`,
    );
    this.name = 'InsufficientCapacityError';
  }
}

export class ConductorNotFoundError extends Error {
  constructor(conductorId: string) {
    super(`Conductor no encontrado: ${conductorId}`);
    this.name = 'ConductorNotFoundError';
  }
}
