import { inject, injectable } from 'inversify';

import { PrismaClient } from '../../generated/client';
import { IGpsPointRepository } from '../../application/ports/gps-point.repository';
import { GpsPoint } from '../../domain/entities/gps-point.entity';
import { TYPES } from '../../types';

@injectable()
export class PrismaGpsPointRepository implements IGpsPointRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async save(gpsPoint: GpsPoint): Promise<GpsPoint> {
    const row = await this.prisma.gpsPoint.create({
      data: {
        id: gpsPoint.id,
        deviceId: gpsPoint.deviceId,
        transferId: gpsPoint.transferId,
        lat: gpsPoint.lat,
        lng: gpsPoint.lng,
        speed: gpsPoint.speed,
        heading: gpsPoint.heading,
        accuracy: gpsPoint.accuracy,
        timestamp: gpsPoint.timestamp,
      },
    });

    return this.toDomain(row);
  }

  async existsByDeviceIdAndTimestamp(deviceId: string, timestamp: Date): Promise<boolean> {
    const count = await this.prisma.gpsPoint.count({
      where: { deviceId, timestamp },
    });

    return count > 0;
  }

  private toDomain(row: {
    id: string;
    deviceId: string;
    transferId: string | null;
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
    timestamp: Date;
  }): GpsPoint {
    return new GpsPoint({
      id: row.id,
      deviceId: row.deviceId,
      transferId: row.transferId,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      heading: row.heading,
      accuracy: row.accuracy,
      timestamp: row.timestamp,
    });
  }
}
