import { randomUUID } from 'crypto';

import Bull from 'bull';
import { AlertType } from '@move/shared';

import { IAlertRepository } from '../../../application/ports/alert.repository';
import { Alert } from '../../../domain/entities/alert.entity';
import { logger } from '../../logger';
import { alertsGeneratedTotal } from '../../metrics/metrics';

import { AlertJobPayload } from './p4-geofence.worker';

export const GPS_P7_QUEUE = 'gps:p7:sse-broadcast';

export interface AlertPersistedPayload {
  readonly alertId: string;
  readonly transferId: string;
  readonly type: AlertType;
  readonly lat: number;
  readonly lng: number;
  readonly message: string;
  readonly createdAt: string;
}

export function registerP6Worker(
  p6Queue: Bull.Queue<AlertJobPayload>,
  p7Queue: Bull.Queue<AlertPersistedPayload>,
  alertRepository: IAlertRepository,
): void {
  void p6Queue.process(async (job) => {
    const payload = job.data;
    const now = new Date();

    const alert = new Alert({
      id: randomUUID(),
      transferId: payload.transferId,
      type: payload.type,
      lat: payload.lat,
      lng: payload.lng,
      message: payload.message,
      createdAt: now,
    });

    const saved = await alertRepository.save(alert);

    if (!saved) {
      logger.debug('P6: alerta duplicada — descartada', {
        transferId: payload.transferId,
        type: payload.type,
      });
      return;
    }

    const p7Payload: AlertPersistedPayload = {
      alertId: saved.id,
      transferId: saved.transferId,
      type: saved.type,
      lat: saved.lat,
      lng: saved.lng,
      message: saved.message,
      createdAt: saved.createdAt.toISOString(),
    };

    await p7Queue.add(p7Payload, { removeOnComplete: true, removeOnFail: false });
    alertsGeneratedTotal.inc({ alert_type: saved.type });
    logger.debug('P6: alerta persistida — encolada en P7', {
      alertId: saved.id,
      type: saved.type,
    });
  });
}
