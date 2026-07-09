export interface GpsJobPayload {
  readonly deviceId: string;
  readonly lat: number;
  readonly lng: number;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly accuracy: number | null;
  readonly timestamp: string;
}

export interface IGpsQueueService {
  enqueueP1(payload: GpsJobPayload): Promise<void>;
}
