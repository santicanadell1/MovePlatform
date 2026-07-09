import Bull from 'bull';
import { AlertType, ZoneType } from '@move/shared';

import { IZoneRepository } from '../../../../application/ports/zone.repository';
import { GpsEnrichedPayload } from '../p2-enrichment.worker';
import { AlertJobPayload, registerP4Worker } from '../p4-geofence.worker';

type P4Handler = (job: Bull.Job<GpsEnrichedPayload>) => Promise<void>;

function makeWorker(findContaining: (lat: number, lng: number) => Promise<{ id: string; type: ZoneType } | null>) {
  let handler: P4Handler | null = null;
  const p5Jobs: GpsEnrichedPayload[] = [];
  const p6Jobs: AlertJobPayload[] = [];

  const p4Queue = {
    process: (fn: P4Handler) => { handler = fn; return Promise.resolve(); },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const p5Queue = {
    add: (payload: GpsEnrichedPayload) => { p5Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const p6Queue = {
    add: (payload: AlertJobPayload) => { p6Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<AlertJobPayload>;

  const zoneRepository: IZoneRepository = { findContaining };

  registerP4Worker(p4Queue, p5Queue, p6Queue, zoneRepository);

  const process = async (payload: GpsEnrichedPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<GpsEnrichedPayload>);
  };

  return { process, p5Jobs, p6Jobs };
}

const basePayload: GpsEnrichedPayload = {
  deviceId: 'device-001',
  transferId: 'transfer-001',
  lat: -34.9,
  lng: -56.1,
  speed: 40,
  heading: 90,
  accuracy: 5,
  timestamp: new Date().toISOString(),
};

describe('P4 geofence worker', () => {
  it('siempre pasa el punto a P5', async () => {
    const { process, p5Jobs } = makeWorker(() => Promise.resolve(null));
    await process(basePayload);
    expect(p5Jobs).toHaveLength(1);
  });

  it('no genera alerta si el punto no está en ninguna zona', async () => {
    const { process, p6Jobs } = makeWorker(() => Promise.resolve(null));
    await process(basePayload);
    expect(p6Jobs).toHaveLength(0);
  });

  it('genera alerta ZONE_RED_ENTRY si el punto está en zona roja', async () => {
    const { process, p6Jobs } = makeWorker(() =>
      Promise.resolve({ id: 'zone-1', type: ZoneType.RED }),
    );
    await process(basePayload);
    expect(p6Jobs).toHaveLength(1);
    expect(p6Jobs[0].type).toBe(AlertType.ZONE_RED_ENTRY);
    expect(p6Jobs[0].transferId).toBe(basePayload.transferId);
  });

  it('genera alerta ZONE_PREFERRED_ENTRY si el punto está en zona preferente', async () => {
    const { process, p6Jobs } = makeWorker(() =>
      Promise.resolve({ id: 'zone-2', type: ZoneType.PREFERRED }),
    );
    await process(basePayload);
    expect(p6Jobs).toHaveLength(1);
    expect(p6Jobs[0].type).toBe(AlertType.ZONE_PREFERRED_ENTRY);
  });

  it('sigue al pipeline si la query PostGIS falla', async () => {
    const { process, p5Jobs, p6Jobs } = makeWorker(() => Promise.reject(new Error('PostGIS error')));
    await process(basePayload);
    expect(p5Jobs).toHaveLength(1);
    expect(p6Jobs).toHaveLength(0);
  });
});
