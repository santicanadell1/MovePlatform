import type { Pool } from 'pg';

import type { PrismaClient } from '../generated/client';

export async function cleanDatabase(prisma: PrismaClient, pool: Pool): Promise<void> {
  // Projection tables (no Prisma model — raw SQL)
  await pool.query('DELETE FROM operations.alerts_projection');
  await pool.query('DELETE FROM operations.transfers_projection');
  await pool.query('DELETE FROM operations.vehicle_assignments');
  await pool.query('DELETE FROM operations.reservations_projection');

  // Prisma-managed tables
  await prisma.$transaction([
    prisma.pricingRule.deleteMany(),
    prisma.category.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Zones via raw SQL (geom es Unsupported en Prisma)
  await pool.query('DELETE FROM zones');
}
