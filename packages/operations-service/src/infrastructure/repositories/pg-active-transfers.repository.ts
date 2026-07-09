import { injectable, inject } from 'inversify';
import { Pool } from 'pg';

import type {
  ActiveAlertData,
  ActiveTransferData,
  ActiveTransferFilters,
  ActiveTransferPage,
  IActiveTransfersRepository,
} from '../../domain/ports/active-transfers.repository.port';
import { TYPES } from '../../types';

interface RawTransferRow {
  id: string;
  reservation_id: string;
  status: string;
  created_at: string;
  origin: string;
  destination: string;
  vehicle_id: string;
  vehicle_plate: string;
  conductor_id: string;
  conductor_name: string;
  active_alerts: Array<{
    id: string;
    type: string;
    message: string;
    lat: number;
    lng: number;
  }> | null;
}

@injectable()
export class PgActiveTransfersRepository implements IActiveTransfersRepository {
  constructor(
    @inject(TYPES.PgPool)
    private readonly pool: Pool,
  ) {}

  async findPage(
    filters: ActiveTransferFilters,
    limit: number,
    cursor: string | null,
  ): Promise<ActiveTransferPage> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.status !== undefined) {
      conditions.push(`t.status::text = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.vehicleId !== undefined) {
      conditions.push(`t.vehicle_id = $${idx++}`);
      params.push(filters.vehicleId);
    }
    if (filters.conductorId !== undefined) {
      conditions.push(`t.conductor_id = $${idx++}`);
      params.push(filters.conductorId);
    }
    if (filters.categoryId !== undefined) {
      conditions.push(`t.category_id = $${idx++}`);
      params.push(filters.categoryId);
    }
    if (filters.hasAlerts === true) {
      conditions.push(
        `EXISTS (SELECT 1 FROM operations.alerts_projection a2 WHERE a2.transfer_id = t.id)`,
      );
    } else if (filters.hasAlerts === false) {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM operations.alerts_projection a2 WHERE a2.transfer_id = t.id)`,
      );
    }
    if (cursor !== null) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        `(date_trunc('milliseconds', t.created_at) < $${idx}::timestamptz OR (date_trunc('milliseconds', t.created_at) = $${idx}::timestamptz AND t.id < $${idx + 1}))`,
      );
      params.push(decoded.createdAt.toISOString(), decoded.id);
      idx += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit + 1);
    const limitParam = `$${idx}`;

    const sql = `
      SELECT
        t.id,
        t.reservation_id,
        t.status              AS status,
        t.created_at,
        t.origin,
        t.destination,
        v.id                  AS vehicle_id,
        v.plate               AS vehicle_plate,
        u.id                  AS conductor_id,
        u.name                AS conductor_name,
        COALESCE(
          json_agg(
            json_build_object('id', a.id, 'type', a.type, 'message', a.message, 'lat', a.lat, 'lng', a.lng)
            ORDER BY a.created_at DESC
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        )                     AS active_alerts
      FROM operations.transfers_projection t
      JOIN operations.vehicles             v ON v.id = t.vehicle_id
      JOIN operations.users                u ON u.firebase_uid = t.conductor_id
      LEFT JOIN operations.alerts_projection a ON a.transfer_id = t.id
      ${whereClause}
      GROUP BY t.id, t.status, t.created_at,
               t.origin, t.destination,
               v.id, v.plate,
               u.id, u.name
      ORDER BY date_trunc('milliseconds', t.created_at) DESC, t.id DESC
      LIMIT ${limitParam}
    `;

    const result = await this.pool.query<RawTransferRow>(sql, params);
    const rows = result.rows;

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const items: ActiveTransferData[] = pageRows.map((row) => this.toData(row));

    const nextCursor =
      hasMore && items.length > 0 ? this.encodeCursor(items[items.length - 1]) : null;

    return { items, nextCursor };
  }

  private toData(row: RawTransferRow): ActiveTransferData {
    const alerts: ActiveAlertData[] = Array.isArray(row.active_alerts)
      ? row.active_alerts.map((a) => ({
          id: a.id,
          type: a.type,
          message: a.message,
          lat: a.lat,
          lng: a.lng,
        }))
      : [];

    return {
      id: row.id,
      reservationId: row.reservation_id,
      origin: row.origin,
      destination: row.destination,
      status: row.status,
      vehicle: { id: row.vehicle_id, plate: row.vehicle_plate },
      conductor: { id: row.conductor_id, name: row.conductor_name },
      activeAlerts: alerts,
      createdAt: new Date(row.created_at),
    };
  }

  private encodeCursor(item: ActiveTransferData): string {
    const payload = JSON.stringify({ createdAt: item.createdAt.toISOString(), id: item.id });
    return Buffer.from(payload).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as { createdAt: string; id: string };
    return { createdAt: new Date(parsed.createdAt), id: parsed.id };
  }
}
