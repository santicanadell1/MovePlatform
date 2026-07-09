import Bull from 'bull';

import { IGpsPointRepository } from '../../../../application/ports/gps-point.repository';
import { GpsPoint } from '../../../../domain/entities/gps-point.entity';
import { GpsEnrichedPayload } from '../p2-enrichment.worker';
import { registerP3Worker } from '../p3-persistence.worker';

type JobHandler = (job: Bull.Job<GpsEnrichedPayload>) => Promise<void>;

function makeWorker(existsByDeviceIdAndTimestamp: (deviceId: string, timestamp: Date) => Promise<boolean>) {
  let handler: JobHandler | null = null;
  const savedPoints: GpsPoint[] = [];
  const p4Jobs: GpsEnrichedPayload[] = [];
  const p5Jobs: GpsEnrichedPayload[] = [];

  const p3Queue = {
    process: (fn: JobHandler) => {
      handler = fn;
      return Promise.resolve();
    },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const p4Queue = {
    add: (payload: GpsEnrichedPayload) => { p4Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const p5Queue = {
    add: (payload: GpsEnrichedPayload) => { p5Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<GpsEnrichedPayload>;

  const repository: IGpsPointRepository = {
    existsByDeviceIdAndTimestamp,
    save: (point: GpsPoint) => {
      savedPoints.push(point);
      return Promise.resolve(point);
    },
  };

  registerP3Worker(p3Queue, p4Queue, p5Queue, repository);

  const process = async (payload: GpsEnrichedPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<GpsEnrichedPayload>);
  };

  return { process, savedPoints, p4Jobs, p5Jobs };
}

const timestamp = new Date('2026-05-19T12:00:00.000Z');

const enrichedPayload: GpsEnrichedPayload = {
  deviceId: 'device-001',
  transferId: 'transfer-999',
  lat: -34.9,
  lng: -56.1,
  speed: 50,
  heading: 270,
  accuracy: 4,
  timestamp: timestamp.toISOString(),
};

describe('P3 persistence worker', () => {
  it('persiste un punto GPS nuevo', async () => {
    const { process, savedPoints } = makeWorker(() => Promise.resolve(false));
    await process(enrichedPayload);
    expect(savedPoints).toHaveLength(1);
  });

  it('el punto persistido tiene los datos correctos', async () => {
    const { process, savedPoints } = makeWorker(() => Promise.resolve(false));
    await process(enrichedPayload);

    const saved = savedPoints[0];
    expect(saved.deviceId).toBe(enrichedPayload.deviceId);
    expect(saved.transferId).toBe(enrichedPayload.transferId);
    expect(saved.lat).toBe(enrichedPayload.lat);
    expect(saved.lng).toBe(enrichedPayload.lng);
    expect(saved.timestamp).toEqual(timestamp);
  });

  it('descarta punto duplicado (mismo deviceId y timestamp)', async () => {
    const { process, savedPoints } = makeWorker(() => Promise.resolve(true));
    await process(enrichedPayload);
    expect(savedPoints).toHaveLength(0);
  });

  it('genera un id único para cada punto', async () => {
    const { process, savedPoints } = makeWorker(() => Promise.resolve(false));
    await process(enrichedPayload);
    await process(enrichedPayload);
    expect(savedPoints[0].id).not.toBe(savedPoints[1].id);
  });

  it('encola en P4 y P5 en paralelo al persistir un punto nuevo', async () => {
    const { process, p4Jobs, p5Jobs } = makeWorker(() => Promise.resolve(false));
    await process(enrichedPayload);
    expect(p4Jobs).toHaveLength(1);
    expect(p5Jobs).toHaveLength(1);
  });

  it('no encola en P4 ni P5 si el punto es duplicado', async () => {
    const { process, p4Jobs, p5Jobs } = makeWorker(() => Promise.resolve(true));
    await process(enrichedPayload);
    expect(p4Jobs).toHaveLength(0);
    expect(p5Jobs).toHaveLength(0);
  });

  it('consulta existencia con el deviceId y timestamp correctos', async () => {
    const calls: Array<{ deviceId: string; timestamp: Date }> = [];
    const { process } = makeWorker((deviceId, ts) => {
      calls.push({ deviceId, timestamp: ts });
      return Promise.resolve(false);
    });

    await process(enrichedPayload);

    expect(calls).toHaveLength(1);
    expect(calls[0].deviceId).toBe(enrichedPayload.deviceId);
    expect(calls[0].timestamp).toEqual(timestamp);
  });
});
