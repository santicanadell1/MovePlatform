import { inject, injectable } from 'inversify';

import { TYPES } from '../../types';
import { GpsJobPayload, IGpsQueueService } from '../ports/gps-queue.service';

export interface ReceiveGpsPointInput {
  readonly deviceId: string;
  readonly lat: number;
  readonly lng: number;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly accuracy: number | null;
  readonly timestamp: string;
}

@injectable()
export class ReceiveGpsPointUseCase {
  constructor(
    @inject(TYPES.GpsQueueService) private readonly gpsQueueService: IGpsQueueService,
  ) {}

  async execute(input: ReceiveGpsPointInput): Promise<void> {
    const payload: GpsJobPayload = {
      deviceId: input.deviceId,
      lat: input.lat,
      lng: input.lng,
      speed: input.speed,
      heading: input.heading,
      accuracy: input.accuracy,
      timestamp: input.timestamp,
    };

    await this.gpsQueueService.enqueueP1(payload);
  }
}
