import Bull from 'bull';

import { ICacheService } from '../../../../application/ports/cache.service';
import { GpsJobPayload } from '../../../../application/ports/gps-queue.service';
import type {
  IVehicleRegistryRepository,
  VehicleRegistryEntry,
} from '../../../../application/ports/vehicle-registry.repository';
import { registerP1Worker } from '../p1-validation.worker';

type JobHandler = (job: Bull.Job<GpsJobPayload>) => Promise<void>;

function makeVehicleRegistry(registered = true): IVehicleRegistryRepository {
  return {
    findVehicleById: () => Promise.resolve(null),
    findVehicleByGpsDeviceId: () =>
      Promise.resolve(
        registered
          ? ({ vehicleId: 'v-1', gpsDeviceId: 'device-abc' } as VehicleRegistryEntry)
          : null,
      ),
  };
}

function makeQueues(hasActiveTransfer = true, deviceRegistered = true) {
  let handler: JobHandler | null = null;
  const p2Jobs: GpsJobPayload[] = [];

  const p1Queue = {
    process: (fn: JobHandler) => {
      handler = fn;
      return Promise.resolve();
    },
  } as unknown as Bull.Queue<GpsJobPayload>;

  const p2Queue = {
    add: (payload: GpsJobPayload) => {
      p2Jobs.push(payload);
      return Promise.resolve();
    },
  } as unknown as Bull.Queue<GpsJobPayload>;

  const cacheService: ICacheService = {
    get: () => Promise.resolve(hasActiveTransfer ? 'transfer-id-123' : null),
    set: async () => {},
    delete: async () => {},
  };

  const vehicleRegistry = makeVehicleRegistry(deviceRegistered);

  registerP1Worker(p1Queue, p2Queue, cacheService, vehicleRegistry);

  const process = async (payload: GpsJobPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<GpsJobPayload>);
  };

  return { process, p2Jobs };
}

const validPayload: GpsJobPayload = {
  deviceId: 'device-abc',
  lat: -34.9,
  lng: -56.1,
  speed: 60,
  heading: 180,
  accuracy: 5,
  timestamp: new Date().toISOString(),
};

describe('P1 validation worker', () => {
  it('pasa un punto válido a P2', async () => {
    const { process, p2Jobs } = makeQueues();
    await process(validPayload);
    expect(p2Jobs).toHaveLength(1);
    expect(p2Jobs[0]).toEqual(validPayload);
  });

  it('descarta punto con deviceId vacío', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, deviceId: '' });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con deviceId solo espacios', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, deviceId: '   ' });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto si el deviceId no está registrado en operations.vehicles', async () => {
    const { process, p2Jobs } = makeQueues(true, false);
    await process(validPayload);
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto si el deviceId no tiene traslado activo en Redis', async () => {
    const { process, p2Jobs } = makeQueues(false);
    await process(validPayload);
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con latitud fuera de rango', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, lat: 91 });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con longitud fuera de rango', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, lng: -181 });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con timestamp inválido', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, timestamp: 'not-a-date' });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con velocidad negativa', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, speed: -1 });
    expect(p2Jobs).toHaveLength(0);
  });

  it('descarta punto con velocidad mayor a 300', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, speed: 301 });
    expect(p2Jobs).toHaveLength(0);
  });

  it('acepta speed null', async () => {
    const { process, p2Jobs } = makeQueues();
    await process({ ...validPayload, speed: null });
    expect(p2Jobs).toHaveLength(1);
  });
});
