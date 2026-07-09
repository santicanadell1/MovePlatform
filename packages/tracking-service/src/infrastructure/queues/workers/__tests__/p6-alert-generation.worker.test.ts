import Bull from 'bull';
import { AlertType } from '@move/shared';

import { IAlertRepository } from '../../../../application/ports/alert.repository';
import { Alert } from '../../../../domain/entities/alert.entity';
import { AlertJobPayload } from '../p4-geofence.worker';
import { AlertPersistedPayload, registerP6Worker } from '../p6-alert-generation.worker';

type P6Handler = (job: Bull.Job<AlertJobPayload>) => Promise<void>;

function makeWorker(saveResult: Alert | null) {
  let handler: P6Handler | null = null;
  const p7Jobs: AlertPersistedPayload[] = [];

  const p6Queue = {
    process: (fn: P6Handler) => { handler = fn; return Promise.resolve(); },
  } as unknown as Bull.Queue<AlertJobPayload>;

  const p7Queue = {
    add: (payload: AlertPersistedPayload) => { p7Jobs.push(payload); return Promise.resolve(); },
  } as unknown as Bull.Queue<AlertPersistedPayload>;

  const alertRepository: IAlertRepository = {
    save: () => Promise.resolve(saveResult),
  };

  registerP6Worker(p6Queue, p7Queue, alertRepository);

  const process = async (payload: AlertJobPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<AlertJobPayload>);
  };

  return { process, p7Jobs };
}

const alertPayload: AlertJobPayload = {
  transferId: 'transfer-001',
  type: AlertType.ZONE_RED_ENTRY,
  lat: -34.9,
  lng: -56.1,
  message: 'Vehículo ingresó a zona roja',
};

const savedAlert = new Alert({
  id: 'alert-uuid-001',
  transferId: 'transfer-001',
  type: AlertType.ZONE_RED_ENTRY,
  lat: -34.9,
  lng: -56.1,
  message: 'Vehículo ingresó a zona roja',
  createdAt: new Date('2026-05-28T10:00:00Z'),
});

describe('P6 alert generation worker', () => {
  it('persiste la alerta y encola en P7', async () => {
    const { process, p7Jobs } = makeWorker(savedAlert);
    await process(alertPayload);
    expect(p7Jobs).toHaveLength(1);
    expect(p7Jobs[0].alertId).toBe(savedAlert.id);
    expect(p7Jobs[0].type).toBe(AlertType.ZONE_RED_ENTRY);
  });

  it('no encola en P7 si la alerta era duplicada (save devuelve null)', async () => {
    const { process, p7Jobs } = makeWorker(null);
    await process(alertPayload);
    expect(p7Jobs).toHaveLength(0);
  });

  it('el payload de P7 tiene todos los campos correctos', async () => {
    const { process, p7Jobs } = makeWorker(savedAlert);
    await process(alertPayload);
    expect(p7Jobs[0]).toMatchObject({
      alertId: savedAlert.id,
      transferId: savedAlert.transferId,
      type: savedAlert.type,
      lat: savedAlert.lat,
      lng: savedAlert.lng,
      message: savedAlert.message,
    });
  });
});
