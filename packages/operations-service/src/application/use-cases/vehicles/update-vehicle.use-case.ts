import { injectable, inject } from 'inversify';

import {
  DuplicateGpsDeviceIdError,
  DuplicatePlateError,
  VehicleNotFoundError,
} from '../../../domain/errors/vehicle.errors';
import type { IVehicleRepository } from '../../../domain/ports/vehicle.repository.port';
import { TYPES } from '../../../types';

export interface UpdateVehicleInput {
  readonly vehicleId: string;
  readonly plate?: string;
  readonly type?: string;
  readonly capacity?: number;
  readonly gpsDeviceId?: string | null;
  readonly available?: boolean;
}

export interface UpdateVehicleOutput {
  readonly id: string;
  readonly plate: string;
  readonly type: string;
  readonly capacity: number;
  readonly gpsDeviceId: string | null;
  readonly available: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class UpdateVehicleUseCase {
  constructor(
    @inject(TYPES.VehicleRepository)
    private readonly vehicleRepo: IVehicleRepository,
  ) {}

  async execute(input: UpdateVehicleInput): Promise<UpdateVehicleOutput> {
    let vehicle = await this.vehicleRepo.findById(input.vehicleId);
    if (!vehicle) throw new VehicleNotFoundError(input.vehicleId);

    if (input.plate !== undefined && input.plate !== vehicle.plate) {
      const duplicate = await this.vehicleRepo.findByPlate(input.plate);
      if (duplicate) throw new DuplicatePlateError(input.plate);
      vehicle = vehicle.withPlate(input.plate);
    }

    if (input.type !== undefined) vehicle = vehicle.withType(input.type);
    if (input.capacity !== undefined) vehicle = vehicle.withCapacity(input.capacity);

    if (input.gpsDeviceId !== undefined) {
      const newGpsId = input.gpsDeviceId;
      if (newGpsId !== null && newGpsId !== vehicle.gpsDeviceId) {
        const duplicate = await this.vehicleRepo.findByGpsDeviceId(newGpsId);
        if (duplicate) throw new DuplicateGpsDeviceIdError(newGpsId);
      }
      vehicle = vehicle.withGpsDeviceId(newGpsId);
    }

    if (input.available !== undefined) vehicle = vehicle.withAvailable(input.available);

    const saved = await this.vehicleRepo.update(vehicle);
    return {
      id: saved.id,
      plate: saved.plate,
      type: saved.type,
      capacity: saved.capacity,
      gpsDeviceId: saved.gpsDeviceId,
      available: saved.available,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
