/**
 * Bootstrap único post-deploy de las proyecciones SOA.
 *
 * Al desplegar el refactor, las proyecciones (operations.*_projection,
 * operations.vehicle_assignments, tracking.vehicles_cache) y el caché Redis de
 * zonas arrancan vacíos. Los datos ya existentes en booking/tracking/operations
 * nunca publicaron sus eventos, así que este script los carga una sola vez.
 *
 * Es el único uso legítimo de SQL cross-schema del proyecto: corre una vez en
 * contexto de migración de datos, nunca en el path crítico de runtime.
 *
 * Uso:
 *   DATABASE_URL=... REDIS_URL=... \
 *     pnpm --filter operations-service exec ts-node --transpile-only scripts/seed-projections.ts
 */
import { Pool } from 'pg';
import Redis from 'ioredis';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

async function seedSqlProjections(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. reservations_projection desde booking.reservations
    await client.query(`
      INSERT INTO operations.reservations_projection
        (id, scheduled_date, origin, destination, goods_summary, category_id, status, vehicle_id, conductor_id)
      SELECT
        r.id,
        r.scheduled_date::date,
        r.origin,
        r.destination,
        COALESCE(
          (SELECT json_agg(json_build_object('size', g.size, 'quantity', g.quantity))
           FROM booking.goods g WHERE g.reservation_id = r.id),
          '[]'::json
        )::jsonb,
        (SELECT g.category_id FROM booking.goods g WHERE g.reservation_id = r.id LIMIT 1),
        r.status::text,
        r.vehicle_id,
        r.conductor_id
      FROM booking.reservations r
      WHERE r.status IN ('CONFIRMED', 'ASSIGNED', 'ACCEPTED')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('reservations_projection: OK');

    // 2. vehicle_assignments desde asignaciones existentes
    await client.query(`
      INSERT INTO operations.vehicle_assignments (vehicle_id, reservation_id, scheduled_date)
      SELECT r.vehicle_id, r.id, r.scheduled_date::date
      FROM booking.reservations r
      WHERE r.vehicle_id IS NOT NULL
        AND r.status NOT IN ('CANCELLED', 'REJECTED')
      ON CONFLICT DO NOTHING
    `);
    console.log('vehicle_assignments: OK');

    // 3. transfers_projection desde tracking.transfers
    await client.query(`
      INSERT INTO operations.transfers_projection
        (id, reservation_id, vehicle_id, conductor_id, status, origin, destination, started_at, finished_at, created_at)
      SELECT
        t.id, t.reservation_id, t.vehicle_id, t.conductor_id,
        t.status::text,
        r.origin, r.destination,
        t.started_at, t.finished_at, t.created_at
      FROM tracking.transfers t
      JOIN booking.reservations r ON r.id = t.reservation_id
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('transfers_projection: OK');

    // 4. alerts_projection desde tracking.alerts
    await client.query(`
      INSERT INTO operations.alerts_projection (id, transfer_id, type, lat, lng, message, created_at)
      SELECT id, transfer_id, type::text, lat, lng, message, created_at
      FROM tracking.alerts
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('alerts_projection: OK');

    // 5. tracking.vehicles_cache desde operations.vehicles
    await client.query(`
      INSERT INTO tracking.vehicles_cache (id, gps_device_id)
      SELECT id, gps_device_id FROM operations.vehicles
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('vehicles_cache: OK');
  } finally {
    client.release();
  }
}

async function seedRedisZones(): Promise<void> {
  // Caché Redis de zonas para P4 (turf.booleanPointInPolygon)
  const { rows } = await pool.query<{ id: string; type: string; geojson: string }>(
    `SELECT id, type::text AS type, ST_AsGeoJSON(geom) AS geojson
     FROM operations.zones WHERE geom IS NOT NULL`,
  );
  for (const zone of rows) {
    await redis.hset(`zones:${zone.id}`, 'type', zone.type, 'geojson', zone.geojson);
    await redis.sadd('zones:all', zone.id);
  }
  console.log(`zones (Redis): OK — ${rows.length} zonas`);
}

async function main(): Promise<void> {
  try {
    await seedSqlProjections();
    await seedRedisZones();
    console.log('seed-projections: completado');
  } finally {
    await pool.end();
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error('seed-projections: error', err);
  process.exit(1);
});
