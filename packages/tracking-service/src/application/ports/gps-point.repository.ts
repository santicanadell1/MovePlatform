import { GpsPoint } from '../../domain/entities/gps-point.entity';

export interface IGpsPointRepository {
  save(gpsPoint: GpsPoint): Promise<GpsPoint>;
  existsByDeviceIdAndTimestamp(deviceId: string, timestamp: Date): Promise<boolean>;
}
