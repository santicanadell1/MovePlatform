import { inject, injectable } from 'inversify';
import type { Pool } from 'pg';

import type {
  IVehicleRegistryRepository,
  VehicleRegistryEntry,
} from '../../application/ports/vehicle-registry.repository';
import { TYPES } from '../../types';

interface VehicleRow {
  id: string;
  gps_device_id: string | null;
}

@injectable()
export class PgVehicleRegistryRepository implements IVehicleRegistryRepository {
  constructor(@inject(TYPES.PgPool) private readonly pool: Pool) {}

  async findVehicleById(vehicleId: string): Promise<VehicleRegistryEntry | null> {
    const result = await this.pool.query<VehicleRow>(
      `SELECT id, gps_device_id FROM tracking.vehicles_cache WHERE id = $1`,
      [vehicleId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { vehicleId: row.id, gpsDeviceId: row.gps_device_id };
  }

  async findVehicleByGpsDeviceId(gpsDeviceId: string): Promise<VehicleRegistryEntry | null> {
    const result = await this.pool.query<VehicleRow>(
      `SELECT id, gps_device_id FROM tracking.vehicles_cache WHERE gps_device_id = $1`,
      [gpsDeviceId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { vehicleId: row.id, gpsDeviceId: row.gps_device_id };
  }
}
