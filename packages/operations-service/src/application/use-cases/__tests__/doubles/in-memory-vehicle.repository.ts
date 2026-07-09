import type { Vehicle } from '../../../../domain/entities/vehicle.entity';
import type {
  IVehicleRepository,
  VehicleFilters,
} from '../../../../domain/ports/vehicle.repository.port';

export class InMemoryVehicleRepository implements IVehicleRepository {
  private vehicles: Vehicle[] = [];

  seed(vehicles: Vehicle[]): void {
    this.vehicles = [...vehicles];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(filters: VehicleFilters): Promise<Vehicle[]> {
    return this.vehicles.filter((v) => {
      if (filters.available !== undefined && v.available !== filters.available) return false;
      if (filters.type !== undefined && v.type !== filters.type) return false;
      return true;
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByPlate(plate: string): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.plate === plate) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByGpsDeviceId(gpsDeviceId: string): Promise<Vehicle | null> {
    return this.vehicles.find((v) => v.gpsDeviceId === gpsDeviceId) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(vehicle: Vehicle): Promise<Vehicle> {
    this.vehicles.push(vehicle);
    return vehicle;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(vehicle: Vehicle): Promise<Vehicle> {
    const idx = this.vehicles.findIndex((v) => v.id === vehicle.id);
    if (idx >= 0) this.vehicles[idx] = vehicle;
    return vehicle;
  }
}
