import Bull from 'bull';

import { GpsJobPayload } from '../../../application/ports/gps-queue.service';
import { ICacheService } from '../../../application/ports/cache.service';
import { logger } from '../../logger';

export const GPS_P2_QUEUE = 'gps:p2:enrichment';

const ACTIVE_TRANSFER_KEY_PREFIX = 'transfer:active:';

export interface GpsEnrichedPayload extends GpsJobPayload {
  readonly transferId: string;
}

export function registerP2Worker(
  p2Queue: Bull.Queue<GpsJobPayload>,
  p3Queue: Bull.Queue<GpsEnrichedPayload>,
  cacheService: ICacheService,
): void {
  void p2Queue.process(async (job) => {
    const payload = job.data;
    const key = `${ACTIVE_TRANSFER_KEY_PREFIX}${payload.deviceId}`;
    const transferId = await cacheService.get(key);

    if (!transferId) {
      logger.debug('P2: sin traslado activo — descartado', { jobId: job.id, deviceId: payload.deviceId });
      return;
    }

    const enriched: GpsEnrichedPayload = { ...payload, transferId };
    await p3Queue.add(enriched, { removeOnComplete: true, removeOnFail: false });
  });
}
