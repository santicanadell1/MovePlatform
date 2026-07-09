import Bull from 'bull';
import { AlertType, ZoneType } from '@move/shared';

import { IZoneRepository } from '../../../application/ports/zone.repository';
import { logger } from '../../logger';

import { GpsEnrichedPayload } from './p2-enrichment.worker';

export const GPS_P4_QUEUE = 'gps:p4:geofence';
export const GPS_P5_QUEUE = 'gps:p5:stop-detection';
export const GPS_P6_QUEUE = 'gps:p6:alert-generation';

export interface AlertJobPayload {
  readonly transferId: string;
  readonly type: AlertType;
  readonly lat: number;
  readonly lng: number;
  readonly message: string;
}

export function registerP4Worker(
  p4Queue: Bull.Queue<GpsEnrichedPayload>,
  p5Queue: Bull.Queue<GpsEnrichedPayload>,
  p6Queue: Bull.Queue<AlertJobPayload>,
  zoneRepository: IZoneRepository,
): void {
  void p4Queue.process(async (job) => {
    const payload = job.data;

    try {
      const zone = await zoneRepository.findContaining(payload.lat, payload.lng);

      if (zone) {
        const type =
          zone.type === ZoneType.RED ? AlertType.ZONE_RED_ENTRY : AlertType.ZONE_PREFERRED_ENTRY;

        const alertJob: AlertJobPayload = {
          transferId: payload.transferId,
          type,
          lat: payload.lat,
          lng: payload.lng,
          message: `Vehículo ingresó a zona ${zone.type.toLowerCase()} (${zone.id})`,
        };

        await p6Queue.add(alertJob, { removeOnComplete: true, removeOnFail: false });
        logger.debug('P4: zona detectada — alerta encolada en P6', {
          deviceId: payload.deviceId,
          zoneType: zone.type,
        });
      }
    } catch (err) {
      logger.error('P4: error en geofence — continuando pipeline', { err });
    }

    await p5Queue.add(payload, { removeOnComplete: true, removeOnFail: false });
  });
}
