import Bull from 'bull';

import type { IVehicleRegistryRepository } from '../../../application/ports/vehicle-registry.repository';
import { ICacheService } from '../../../application/ports/cache.service';
import { GpsJobPayload } from '../../../application/ports/gps-queue.service';
import { logger } from '../../logger';
import { gpsPointsProcessedTotal } from '../../metrics/metrics';

export const GPS_P2_QUEUE = 'gps:p2:enrichment';

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;
const SPEED_MAX = 300;
const ACTIVE_TRANSFER_KEY_PREFIX = 'transfer:active:';

function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;
}

function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

function isValidSpeed(speed: number | null): boolean {
  return speed === null || (speed >= 0 && speed <= SPEED_MAX);
}

export function registerP1Worker(
  p1Queue: Bull.Queue<GpsJobPayload>,
  p2Queue: Bull.Queue<GpsJobPayload>,
  cacheService: ICacheService,
  vehicleRegistry: IVehicleRegistryRepository,
): void {
  void p1Queue.process(async (job) => {
    const payload = job.data;

    if (!payload.deviceId || payload.deviceId.trim() === '') {
      logger.warn('P1: deviceId vacío — descartado', { jobId: job.id });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    const registeredVehicle = await vehicleRegistry.findVehicleByGpsDeviceId(payload.deviceId);
    if (!registeredVehicle) {
      logger.debug('P1: deviceId no registrado en tracking.vehicles_cache — descartado', {
        jobId: job.id,
        deviceId: payload.deviceId,
      });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    const activeTransfer = await cacheService.get(
      `${ACTIVE_TRANSFER_KEY_PREFIX}${payload.deviceId}`,
    );
    if (!activeTransfer) {
      logger.debug('P1: deviceId sin traslado activo — descartado', {
        jobId: job.id,
        deviceId: payload.deviceId,
      });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    if (!isValidCoordinates(payload.lat, payload.lng)) {
      logger.warn('P1: coordenadas fuera de rango — descartado', {
        jobId: job.id,
        lat: payload.lat,
        lng: payload.lng,
      });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    if (!isValidTimestamp(payload.timestamp)) {
      logger.warn('P1: timestamp inválido — descartado', {
        jobId: job.id,
        timestamp: payload.timestamp,
      });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    if (!isValidSpeed(payload.speed)) {
      logger.warn('P1: velocidad fuera de rango — descartado', {
        jobId: job.id,
        speed: payload.speed,
      });
      gpsPointsProcessedTotal.inc({ result: 'discarded' });
      return;
    }

    await p2Queue.add(payload, { removeOnComplete: true, removeOnFail: false });
    gpsPointsProcessedTotal.inc({ result: 'accepted' });
  });
}
