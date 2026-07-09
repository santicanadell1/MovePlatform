import Bull from 'bull';
import { AlertType } from '@move/shared';

import { ICacheService } from '../../../application/ports/cache.service';
import { logger } from '../../logger';

import { GpsEnrichedPayload } from './p2-enrichment.worker';
import { AlertJobPayload } from './p4-geofence.worker';
import { calculateDistanceMeters } from './utils/distance';

const LAST_MOVE_KEY_PREFIX = 'gps:lastmove:';

interface LastMoveState {
  lat: number;
  lng: number;
  timestamp: string;
}

const STOP_THRESHOLD_SECONDS = parseInt(process.env.STOP_THRESHOLD_SECONDS ?? '180', 10);
const STOP_DISTANCE_METERS = parseInt(process.env.STOP_DISTANCE_METERS ?? '50', 10);

export function registerP5Worker(
  p5Queue: Bull.Queue<GpsEnrichedPayload>,
  p6Queue: Bull.Queue<AlertJobPayload>,
  cacheService: ICacheService,
): void {
  void p5Queue.process(async (job) => {
    const payload = job.data;
    const key = `${LAST_MOVE_KEY_PREFIX}${payload.deviceId}`;
    const now = new Date(payload.timestamp);

    const raw = await cacheService.get(key);

    if (!raw) {
      await cacheService.set(key, JSON.stringify({ lat: payload.lat, lng: payload.lng, timestamp: payload.timestamp }));
      return;
    }

    const last = JSON.parse(raw) as LastMoveState;
    const distanceMeters = calculateDistanceMeters(last.lat, last.lng, payload.lat, payload.lng);
    const elapsedSeconds = (now.getTime() - new Date(last.timestamp).getTime()) / 1000;

    if (distanceMeters > STOP_DISTANCE_METERS) {
      await cacheService.set(key, JSON.stringify({ lat: payload.lat, lng: payload.lng, timestamp: payload.timestamp }));
      return;
    }

    if (elapsedSeconds >= STOP_THRESHOLD_SECONDS) {
      const alertJob: AlertJobPayload = {
        transferId: payload.transferId,
        type: AlertType.STOP_DETECTED,
        lat: payload.lat,
        lng: payload.lng,
        message: `Vehículo detenido por más de ${Math.round(elapsedSeconds / 60)} minutos`,
      };

      await p6Queue.add(alertJob, { removeOnComplete: true, removeOnFail: false });
      logger.debug('P5: parada prolongada detectada — alerta encolada en P6', {
        deviceId: payload.deviceId,
        elapsedSeconds,
        distanceMeters,
      });

      await cacheService.set(key, JSON.stringify({ lat: payload.lat, lng: payload.lng, timestamp: payload.timestamp }));
    }
  });
}
