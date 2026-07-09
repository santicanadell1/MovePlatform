import Bull from 'bull';
import { AlertType } from '@move/shared';

import { ICacheService } from '../../../../application/ports/cache.service';
import { GpsEnrichedPayload } from '../p2-enrichment.worker';
import { AlertJobPayload } from '../p4-geofence.worker';
import { registerP5Worker } from '../p5-stop-detection.worker';

type P5Handler = (job: Bull.Job<GpsEnrichedPayload>) => Promise<void>;

function makeWorker(initialCacheValue: string | null = null) {
  let handler: P5Handler | null = null;
  const p6Jobs: AlertJobPayload[] = [];
  const cacheStore: Record<string, string> = {};

  if (initialCacheValue !== null) {
    cacheStore['gps:lastmove:device-001'] = initialCacheValue;
  }

  const p5Queue = {
    process: (fn: P5Handler) => { handler = fn; return Promise.resolve(); },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const p6Queue = {
    add: (payload: AlertJobPayload) => { p6Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<AlertJobPayload>;

  const cacheService: ICacheService = {
    get: (key: string) => Promise.resolve(cacheStore[key] ?? null),
    set: (key: string, value: string) => { cacheStore[key] = value; return Promise.resolve(); },
    delete: (key: string) => { delete cacheStore[key]; return Promise.resolve(); },
  };

  registerP5Worker(p5Queue, p6Queue, cacheService);

  const process = async (payload: GpsEnrichedPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<GpsEnrichedPayload>);
  };

  return { process, p6Jobs, cacheStore };
}

const basePayload: GpsEnrichedPayload = {
  deviceId: 'device-001',
  transferId: 'transfer-001',
  lat: -34.9,
  lng: -56.1,
  speed: 0,
  heading: null,
  accuracy: 5,
  timestamp: new Date().toISOString(),
};

describe('P5 stop detection worker', () => {
  it('guarda lastMoveAt si es el primer punto del device', async () => {
    const { process, cacheStore } = makeWorker(null);
    await process(basePayload);
    expect(cacheStore['gps:lastmove:device-001']).toBeDefined();
  });

  it('no genera alerta en el primer punto', async () => {
    const { process, p6Jobs } = makeWorker(null);
    await process(basePayload);
    expect(p6Jobs).toHaveLength(0);
  });

  it('no genera alerta si el vehículo se movió más de 50 metros', async () => {
    const pastState = JSON.stringify({
      lat: -34.0,
      lng: -56.0,
      timestamp: new Date(Date.now() - 200_000).toISOString(),
    });
    const { process, p6Jobs } = makeWorker(pastState);
    await process(basePayload);
    expect(p6Jobs).toHaveLength(0);
  });

  it('no genera alerta si no pasaron 3 minutos aunque esté quieto', async () => {
    const pastState = JSON.stringify({
      lat: basePayload.lat,
      lng: basePayload.lng,
      timestamp: new Date(Date.now() - 60_000).toISOString(),
    });
    const { process, p6Jobs } = makeWorker(pastState);
    await process(basePayload);
    expect(p6Jobs).toHaveLength(0);
  });

  it('genera alerta STOP_DETECTED si el vehículo no se movió en más de 3 minutos', async () => {
    const pastState = JSON.stringify({
      lat: basePayload.lat,
      lng: basePayload.lng,
      timestamp: new Date(Date.now() - 200_000).toISOString(),
    });
    const { process, p6Jobs } = makeWorker(pastState);
    await process(basePayload);
    expect(p6Jobs).toHaveLength(1);
    expect(p6Jobs[0].type).toBe(AlertType.STOP_DETECTED);
    expect(p6Jobs[0].transferId).toBe(basePayload.transferId);
  });
});
