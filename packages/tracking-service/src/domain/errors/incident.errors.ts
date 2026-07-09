export class IncidentTransferNotFoundError extends Error {
  constructor(transferId: string) {
    super(`Transfer ${transferId} not found`);
    this.name = 'IncidentTransferNotFoundError';
  }
}

export class IncidentConductorMismatchError extends Error {
  constructor() {
    super('Conductor is not assigned to this transfer');
    this.name = 'IncidentConductorMismatchError';
  }
}

export class IncidentTransferNotInTransitError extends Error {
  constructor(transferId: string) {
    super(`Transfer ${transferId} is not in IN_TRANSIT status`);
    this.name = 'IncidentTransferNotInTransitError';
  }
}
