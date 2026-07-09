import type { Vehicle } from '../entities/vehicle.entity';

export interface VehicleFilters {
  readonly available?: boolean;
  readonly type?: string;
}

export interface IVehicleRepository {
  findAll(filters: VehicleFilters): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  findByGpsDeviceId(gpsDeviceId: string): Promise<Vehicle | null>;
  create(vehicle: Vehicle): Promise<Vehicle>;
  update(vehicle: Vehicle): Promise<Vehicle>;
}
