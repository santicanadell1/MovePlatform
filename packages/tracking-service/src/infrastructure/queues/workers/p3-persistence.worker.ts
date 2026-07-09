import { randomUUID } from 'crypto';

import Bull from 'bull';

import { IGpsPointRepository } from '../../../application/ports/gps-point.repository';
import { GpsPoint } from '../../../domain/entities/gps-point.entity';
import { logger } from '../../logger';

import { GpsEnrichedPayload } from './p2-enrichment.worker';

export const GPS_P3_QUEUE = 'gps:p3:persistence';

export function registerP3Worker(
  p3Queue: Bull.Queue<GpsEnrichedPayload>,
  p4Queue: Bull.Queue<GpsEnrichedPayload>,
  p5Queue: Bull.Queue<GpsEnrichedPayload>,
  gpsPointRepository: IGpsPointRepository,
): void {
  void p3Queue.process(async (job) => {
    const payload = job.data;
    const timestamp = new Date(payload.timestamp);

    const isDuplicate = await gpsPointRepository.existsByDeviceIdAndTimestamp(payload.deviceId, timestamp);
    if (isDuplicate) {
      logger.debug('P3: punto duplicado — descartado', {
        jobId: job.id,
        deviceId: payload.deviceId,
        timestamp: payload.timestamp,
      });
      return;
    }

    const gpsPoint = new GpsPoint({
      id: randomUUID(),
      deviceId: payload.deviceId,
      transferId: payload.transferId,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
      heading: payload.heading,
      accuracy: payload.accuracy,
      timestamp,
    });

    await gpsPointRepository.save(gpsPoint);
    logger.debug('P3: punto GPS persistido', { deviceId: payload.deviceId, transferId: payload.transferId });

    await Promise.all([
      p4Queue.add(payload, { removeOnComplete: true, removeOnFail: false }),
      p5Queue.add(payload, { removeOnComplete: true, removeOnFail: false }),
    ]);
  });
}
