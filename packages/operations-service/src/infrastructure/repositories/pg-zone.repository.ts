import { injectable, inject } from 'inversify';
import type { Pool } from 'pg';

import { Zone } from '../../domain/entities/zone.entity';
import type { GeoJsonPolygon } from '../../domain/entities/zone.entity';
import { InvalidPolygonError } from '../../domain/errors/zone.errors';
import type { IZoneRepository } from '../../domain/ports/zone.repository.port';
import { TYPES } from '../../types';

interface ZoneRow {
  id: string;
  name: string;
  type: 'RED' | 'PREFERRED';
  geom: GeoJsonPolygon;
  created_at: Date;
  updated_at: Date;
}

@injectable()
export class PgZoneRepository implements IZoneRepository {
  constructor(
    @inject(TYPES.PgPool)
    private readonly pool: Pool,
  ) {}

  async findAll(): Promise<Zone[]> {
    const result = await this.pool.query<ZoneRow>(`
      SELECT id, name, type, ST_AsGeoJSON(geom)::json AS geom, created_at, updated_at
      FROM zones
      ORDER BY created_at ASC
    `);
    return result.rows.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<Zone | null> {
    const result = await this.pool.query<ZoneRow>(
      `SELECT id, name, type, ST_AsGeoJSON(geom)::json AS geom, created_at, updated_at
       FROM zones WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.toEntity(result.rows[0]) : null;
  }

  async create(zone: Zone): Promise<Zone> {
    await this.validatePolygon(zone.geom);

    const result = await this.pool.query<ZoneRow>(
      `INSERT INTO zones (id, name, type, geom, created_at, updated_at)
       VALUES ($1, $2, $3::"ZoneType", ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), $5, $6)
       RETURNING id, name, type, ST_AsGeoJSON(geom)::json AS geom, created_at, updated_at`,
      [zone.id, zone.name, zone.type, JSON.stringify(zone.geom), zone.createdAt, zone.updatedAt],
    );
    return this.toEntity(result.rows[0]);
  }

  async update(zone: Zone): Promise<Zone> {
    await this.validatePolygon(zone.geom);

    const result = await this.pool.query<ZoneRow>(
      `UPDATE zones
       SET name = $2, type = $3::"ZoneType", geom = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), updated_at = $5
       WHERE id = $1
       RETURNING id, name, type, ST_AsGeoJSON(geom)::json AS geom, created_at, updated_at`,
      [zone.id, zone.name, zone.type, JSON.stringify(zone.geom), zone.updatedAt],
    );
    return this.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM zones WHERE id = $1', [id]);
  }

  private async validatePolygon(geom: GeoJsonPolygon): Promise<void> {
    const result = await this.pool.query<{ is_valid: boolean }>(
      `SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS is_valid`,
      [JSON.stringify(geom)],
    );
    if (!result.rows[0]?.is_valid) {
      throw new InvalidPolygonError();
    }
  }

  private toEntity(row: ZoneRow): Zone {
    return Zone.create({
      id: row.id,
      name: row.name,
      type: row.type,
      geom: row.geom,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
