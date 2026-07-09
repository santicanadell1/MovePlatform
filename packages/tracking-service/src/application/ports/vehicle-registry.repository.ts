export interface VehicleRegistryEntry {
  readonly vehicleId: string;
  readonly gpsDeviceId: string | null;
}

export interface IVehicleRegistryRepository {
  findVehicleById(vehicleId: string): Promise<VehicleRegistryEntry | null>;
  findVehicleByGpsDeviceId(gpsDeviceId: string): Promise<VehicleRegistryEntry | null>;
}
