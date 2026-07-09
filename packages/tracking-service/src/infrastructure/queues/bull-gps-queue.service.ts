import Bull from 'bull';
import { injectable } from 'inversify';

import { GpsJobPayload, IGpsQueueService } from '../../application/ports/gps-queue.service';

export const GPS_P1_QUEUE = 'gps:p1:validation';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

@injectable()
export class BullGpsQueueService implements IGpsQueueService {
  private readonly queue: Bull.Queue<GpsJobPayload>;

  constructor() {
    // Bull must manage its own Redis connections — pass URL string, not a shared ioredis instance
    this.queue = new Bull<GpsJobPayload>(GPS_P1_QUEUE, redisUrl);
  }

  async enqueueP1(payload: GpsJobPayload): Promise<void> {
    await this.queue.add(payload, { removeOnComplete: true, removeOnFail: false });
  }
}
