import Bull from 'bull';
import { AlertType } from '@move/shared';

import { IEventPublisher } from '../../../../application/ports/event-publisher';
import { AlertPersistedPayload } from '../p6-alert-generation.worker';
import { registerP7Worker } from '../p7-notification.worker';

type P7Handler = (job: Bull.Job<AlertPersistedPayload>) => Promise<void>;

function makeWorker(publishImpl: () => Promise<void>) {
  let handler: P7Handler | null = null;

  const p7Queue = {
    process: (fn: P7Handler) => { handler = fn; return Promise.resolve(); },
  } as unknown as Bull.Queue<AlertPersistedPayload>;

  const eventPublisher: IEventPublisher = { publish: publishImpl };

  registerP7Worker(p7Queue, eventPublisher);

  const process = async (payload: AlertPersistedPayload) => {
    if (!handler) throw new Error('handler not registered');
    await handler({ id: '1', data: payload } as Bull.Job<AlertPersistedPayload>);
  };

  return { process };
}

const alertPayload: AlertPersistedPayload = {
  alertId: 'alert-001',
  transferId: 'transfer-001',
  type: AlertType.ZONE_RED_ENTRY,
  lat: -34.9,
  lng: -56.1,
  message: 'Vehículo ingresó a zona roja',
  createdAt: new Date().toISOString(),
};

describe('P7 notification worker', () => {
  it('publica el evento alert.created en RabbitMQ', async () => {
    const published: unknown[] = [];
    const { process } = makeWorker(() => { published.push(true); return Promise.resolve(); });

    await process(alertPayload);

    expect(published).toHaveLength(1);
  });

  it('no lanza error si RabbitMQ falla — alerta ya está en DB', async () => {
    const { process } = makeWorker(() => Promise.reject(new Error('RabbitMQ caído')));

    await expect(process(alertPayload)).resolves.not.toThrow();
  });
});
