import Bull from 'bull';

import { ICacheService } from '../../../../application/ports/cache.service';
import { GpsJobPayload } from '../../../../application/ports/gps-queue.service';
import { GpsEnrichedPayload, registerP2Worker } from '../p2-enrichment.worker';

type JobHandler = (job: Bull.Job<GpsJobPayload>) => Promise<void>;

function makeQueues(cacheGet: (key: string) => Promise<string | null>) {
  let handler: JobHandler | null = null;
  const p3Jobs: GpsEnrichedPayload[] = [];

  const p2Queue = {
    process: (fn: JobHandler) => {
      handler = fn;
      return Promise.resolve();
    },
  } as unknown as Bull.Queue<GpsJobPayload>;

  const p3Queue = {
    add: (payload: GpsEnrichedPayload) => {
      p3Jobs.push(payload);
      return Promise.resolve();
    },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const cacheService: ICacheService = {
    get: cacheGet,
    set: async () => {},
    delete: async () => {},
  };

  registerP2Worker(p2Queue, p3Queue, cacheService);

  const process = async (payload: GpsJobPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<GpsJobPayload>);
  };

  return { process, p3Jobs };
}

const basePayload: GpsJobPayload = {
  deviceId: 'device-xyz',
  lat: -34.9,
  lng: -56.1,
  speed: 60,
  heading: 90,
  accuracy: 3,
  timestamp: new Date().toISOString(),
};

describe('P2 enrichment worker', () => {
  it('enriquece con transferId cuando hay traslado activo', async () => {
    const transferId = 'transfer-001';
    const { process, p3Jobs } = makeQueues(() => Promise.resolve(transferId));

    await process(basePayload);

    expect(p3Jobs).toHaveLength(1);
    expect(p3Jobs[0].transferId).toBe(transferId);
    expect(p3Jobs[0].deviceId).toBe(basePayload.deviceId);
  });

  it('descarta punto si no hay traslado activo en Redis', async () => {
    const { process, p3Jobs } = makeQueues(() => Promise.resolve(null));

    await process(basePayload);

    expect(p3Jobs).toHaveLength(0);
  });

  it('consulta Redis con la clave correcta', async () => {
    const keys: string[] = [];
    const { process } = makeQueues((key) => {
      keys.push(key);
      return Promise.resolve(null);
    });

    await process(basePayload);

    expect(keys).toEqual([`transfer:active:${basePayload.deviceId}`]);
  });
});
