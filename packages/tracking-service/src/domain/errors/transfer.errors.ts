export class TransferNotFoundError extends Error {
  constructor(reservationId: string) {
    super(`Transfer not found for reservation ${reservationId}`);
    this.name = 'TransferNotFoundError';
  }
}

export class TransferNotPendingError extends Error {
  constructor(reservationId: string) {
    super(`Transfer for reservation ${reservationId} is not in PENDING status`);
    this.name = 'TransferNotPendingError';
  }
}

export class TransferNotInTransitError extends Error {
  constructor(reservationId: string) {
    super(`Transfer for reservation ${reservationId} is not in IN_TRANSIT status`);
    this.name = 'TransferNotInTransitError';
  }
}

export class ConductorMismatchError extends Error {
  constructor() {
    super('Conductor is not assigned to this transfer');
    this.name = 'ConductorMismatchError';
  }
}

export class VehicleAlreadyInTransitError extends Error {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} already has an active transfer in progress`);
    this.name = 'VehicleAlreadyInTransitError';
  }
}

export class VehicleNotRegisteredError extends Error {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} is not registered in operations service`);
    this.name = 'VehicleNotRegisteredError';
  }
}
