import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';
import { ZoneType } from '@move/shared';
import { inject, injectable } from 'inversify';
import type Redis from 'ioredis';

import type { IZoneRepository } from '../../application/ports/zone.repository';
import type { ZoneMatch } from '../../domain/value-objects/zone-match.vo';
import { TYPES } from '../../types';

interface PolygonGeom {
  readonly type: 'Polygon';
  readonly coordinates: number[][][];
}
interface PolygonFeature {
  readonly type: 'Feature';
  readonly geometry: PolygonGeom;
}

const ZONES_SET = 'zones:all';
const zoneKey = (id: string): string => `zones:${id}`;

/**
 * Caché de zonas en Redis sincronizado por eventos zone.created/updated/deleted.
 * Reemplaza el cross-schema ST_Contains sobre operations.zones (R7): P4 usa
 * turf.booleanPointInPolygon en memoria. Para el volumen del demo (<20 zonas)
 * la performance es equivalente al índice GiST.
 */
@injectable()
export class RedisZoneRepository implements IZoneRepository {
  constructor(@inject(TYPES.RedisClient) private readonly redis: Redis) {}

  async findContaining(lat: number, lng: number): Promise<ZoneMatch | null> {
    const zoneIds = await this.redis.smembers(ZONES_SET);
    if (zoneIds.length === 0) return null;

    const pt = point([lng, lat]);

    for (const id of zoneIds) {
      const [geojsonStr, type] = await Promise.all([
        this.redis.hget(zoneKey(id), 'geojson'),
        this.redis.hget(zoneKey(id), 'type'),
      ]);
      if (!geojsonStr || !type) continue;

      try {
        const geom = JSON.parse(geojsonStr) as PolygonGeom | PolygonFeature;
        const coordinates = geom.type === 'Feature' ? geom.geometry.coordinates : geom.coordinates;
        const poly = polygon(coordinates);
        if (booleanPointInPolygon(pt, poly)) {
          return { id, type: type as ZoneType };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  // Métodos para el consumer — no son parte de IZoneRepository (se llaman directo)
  async upsertZone(id: string, type: string, geojson: string): Promise<void> {
    await this.redis.hset(zoneKey(id), 'type', type, 'geojson', geojson);
    await this.redis.sadd(ZONES_SET, id);
  }

  async deleteZone(id: string): Promise<void> {
    await this.redis.del(zoneKey(id));
    await this.redis.srem(ZONES_SET, id);
  }
}
