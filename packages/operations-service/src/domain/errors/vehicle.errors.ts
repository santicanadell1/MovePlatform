export class VehicleNotFoundError extends Error {
  constructor(id: string) {
    super(`Vehículo no encontrado: ${id}`);
    this.name = 'VehicleNotFoundError';
  }
}

export class DuplicatePlateError extends Error {
  constructor(plate: string) {
    super(`Ya existe un vehículo con la matrícula: ${plate}`);
    this.name = 'DuplicatePlateError';
  }
}

export class DuplicateGpsDeviceIdError extends Error {
  constructor(gpsDeviceId: string) {
    super(`Ya existe un vehículo con el dispositivo GPS: ${gpsDeviceId}`);
    this.name = 'DuplicateGpsDeviceIdError';
  }
}
