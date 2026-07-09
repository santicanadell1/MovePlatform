import type { Pool } from 'pg';

import { PrismaClient } from '../generated/client';

export async function cleanDb(prisma: PrismaClient, pgPool: Pool): Promise<void> {
  await prisma.incident.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.gpsPoint.deleteMany();
  await prisma.transfer.deleteMany();
  try {
    await pgPool.query(`DELETE FROM tracking.vehicles_cache WHERE id LIKE 'test-%'`);
  } catch {
    // vehicles_cache puede no existir en entornos locales sin todas las migraciones
  }
}

export async function seedVehicle(
  pgPool: Pool,
  vehicle: { id: string; gpsDeviceId?: string },
): Promise<void> {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS tracking.vehicles_cache (
      id             TEXT PRIMARY KEY,
      gps_device_id  TEXT UNIQUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pgPool.query(
    `INSERT INTO tracking.vehicles_cache (id, gps_device_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [vehicle.id, vehicle.gpsDeviceId ?? null],
  );
}
