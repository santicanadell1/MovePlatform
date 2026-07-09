import { injectable, inject } from 'inversify';

import type { IVehicleRepository } from '../../../domain/ports/vehicle.repository.port';
import { TYPES } from '../../../types';

export interface GetVehiclesInput {
  readonly available?: boolean;
  readonly type?: string;
}

export interface VehicleOutput {
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
export class GetVehiclesUseCase {
  constructor(
    @inject(TYPES.VehicleRepository)
    private readonly vehicleRepo: IVehicleRepository,
  ) {}

  async execute(input: GetVehiclesInput = {}): Promise<VehicleOutput[]> {
    const vehicles = await this.vehicleRepo.findAll(input);
    return vehicles.map((v) => ({
      id: v.id,
      plate: v.plate,
      type: v.type,
      capacity: v.capacity,
      gpsDeviceId: v.gpsDeviceId,
      available: v.available,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }
}
