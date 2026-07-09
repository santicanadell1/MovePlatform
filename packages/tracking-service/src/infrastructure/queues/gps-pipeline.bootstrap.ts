import Bull from 'bull';

import { IAlertRepository } from '../../application/ports/alert.repository';
import { ICacheService } from '../../application/ports/cache.service';
import { IEventPublisher } from '../../application/ports/event-publisher';
import { IGpsPointRepository } from '../../application/ports/gps-point.repository';
import { GpsJobPayload } from '../../application/ports/gps-queue.service';
import { IZoneRepository } from '../../application/ports/zone.repository';
import type { IVehicleRegistryRepository } from '../../application/ports/vehicle-registry.repository';

import { GPS_P1_QUEUE } from './bull-gps-queue.service';
import { GPS_P2_QUEUE, GpsEnrichedPayload } from './workers/p2-enrichment.worker';
import { GPS_P3_QUEUE } from './workers/p3-persistence.worker';
import { AlertJobPayload, GPS_P4_QUEUE, GPS_P5_QUEUE, GPS_P6_QUEUE } from './workers/p4-geofence.worker';
import { AlertPersistedPayload, GPS_P7_QUEUE } from './workers/p6-alert-generation.worker';
import { registerP7Worker } from './workers/p7-notification.worker';
import { registerP1Worker } from './workers/p1-validation.worker';
import { registerP2Worker } from './workers/p2-enrichment.worker';
import { registerP3Worker } from './workers/p3-persistence.worker';
import { registerP4Worker } from './workers/p4-geofence.worker';
import { registerP5Worker } from './workers/p5-stop-detection.worker';
import { registerP6Worker } from './workers/p6-alert-generation.worker';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export function bootstrapGpsPipeline(
  cacheService: ICacheService,
  gpsPointRepository: IGpsPointRepository,
  zoneRepository: IZoneRepository,
  alertRepository: IAlertRepository,
  eventPublisher: IEventPublisher,
  vehicleRegistry: IVehicleRegistryRepository,
): void {
  const p1Queue = new Bull<GpsJobPayload>(GPS_P1_QUEUE, redisUrl);
  const p2Queue = new Bull<GpsJobPayload>(GPS_P2_QUEUE, redisUrl);
  const p3Queue = new Bull<GpsEnrichedPayload>(GPS_P3_QUEUE, redisUrl);
  const p4Queue = new Bull<GpsEnrichedPayload>(GPS_P4_QUEUE, redisUrl);
  const p5Queue = new Bull<GpsEnrichedPayload>(GPS_P5_QUEUE, redisUrl);
  const p6Queue = new Bull<AlertJobPayload>(GPS_P6_QUEUE, redisUrl);
  const p7Queue = new Bull<AlertPersistedPayload>(GPS_P7_QUEUE, redisUrl);

  registerP1Worker(p1Queue, p2Queue, cacheService, vehicleRegistry);
  registerP2Worker(p2Queue, p3Queue, cacheService);
  registerP3Worker(p3Queue, p4Queue, p5Queue, gpsPointRepository);
  registerP4Worker(p4Queue, p5Queue, p6Queue, zoneRepository);
  registerP5Worker(p5Queue, p6Queue, cacheService);
  registerP6Worker(p6Queue, p7Queue, alertRepository);
  registerP7Worker(p7Queue, eventPublisher);
}
