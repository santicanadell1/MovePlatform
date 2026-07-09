import type { Pool, QueryResult } from 'pg';

import { PgVehicleRegistryRepository } from '../pg-vehicle-registry.repository';

function makePool(rows: unknown[]): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows } as QueryResult),
  } as unknown as Pool;
}

describe('PgVehicleRegistryRepository', () => {
  describe('findVehicleById', () => {
    it('retorna la entrada cuando el vehículo existe', async () => {
      const pool = makePool([{ id: 'v-1', gps_device_id: 'gps-abc' }]);
      const repo = new PgVehicleRegistryRepository(pool);

      const result = await repo.findVehicleById('v-1');

      expect(result).toEqual({ vehicleId: 'v-1', gpsDeviceId: 'gps-abc' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('tracking.vehicles_cache'), [
        'v-1',
      ]);
    });

    it('retorna null cuando el vehículo no existe', async () => {
      const pool = makePool([]);
      const repo = new PgVehicleRegistryRepository(pool);

      const result = await repo.findVehicleById('no-existe');

      expect(result).toBeNull();
    });

    it('retorna la entrada cuando el vehículo existe pero sin gps_device_id', async () => {
      const pool = makePool([{ id: 'v-2', gps_device_id: null }]);
      const repo = new PgVehicleRegistryRepository(pool);

      const result = await repo.findVehicleById('v-2');

      expect(result).toEqual({ vehicleId: 'v-2', gpsDeviceId: null });
    });
  });

  describe('findVehicleByGpsDeviceId', () => {
    it('retorna la entrada cuando el deviceId está registrado', async () => {
      const pool = makePool([{ id: 'v-1', gps_device_id: 'gps-abc' }]);
      const repo = new PgVehicleRegistryRepository(pool);

      const result = await repo.findVehicleByGpsDeviceId('gps-abc');

      expect(result).toEqual({ vehicleId: 'v-1', gpsDeviceId: 'gps-abc' });
    });

    it('retorna null cuando el deviceId no está registrado', async () => {
      const pool = makePool([]);
      const repo = new PgVehicleRegistryRepository(pool);

      const result = await repo.findVehicleByGpsDeviceId('no-registrado');

      expect(result).toBeNull();
    });
  });
});
