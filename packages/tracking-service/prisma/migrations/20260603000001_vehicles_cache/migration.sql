-- Caché local de vehículos en tracking, alimentada por el evento vehicle.registered
-- de operations. Elimina el cross-schema FROM operations.vehicles en P1/F13 (R7).
-- id es TEXT (consistente con operations.vehicles.id, que es Prisma String).
CREATE TABLE IF NOT EXISTS tracking.vehicles_cache (
  id             TEXT PRIMARY KEY,
  gps_device_id  TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
