-- Proyecciones SOA: operations materializa copias locales de datos de booking/tracking
-- alimentadas por eventos RabbitMQ, eliminando los cross-schema SQL de F12 y F18.
SET search_path TO operations, public;

-- IDs son TEXT en todo el sistema (Prisma String / randomUUID como string) — no UUID nativo.
-- Proyección de reservas de booking (para F12 — asignación sin cross-schema)
CREATE TABLE IF NOT EXISTS operations.reservations_projection (
  id              TEXT        PRIMARY KEY,
  scheduled_date  DATE        NOT NULL,
  origin          TEXT        NOT NULL,
  destination     TEXT        NOT NULL,
  goods_summary   JSONB       NOT NULL DEFAULT '[]',
  category_id     TEXT,
  status          TEXT        NOT NULL DEFAULT 'CONFIRMED',
  vehicle_id      TEXT,
  conductor_id    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro de asignaciones (para conflict check en F12 — solo operations.*)
CREATE TABLE IF NOT EXISTS operations.vehicle_assignments (
  vehicle_id      TEXT  NOT NULL,
  reservation_id  TEXT  NOT NULL,
  scheduled_date  DATE  NOT NULL,
  PRIMARY KEY (vehicle_id, reservation_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_date
  ON operations.vehicle_assignments (vehicle_id, scheduled_date);

-- Proyección de traslados de tracking (para F18 — traslados en curso)
CREATE TABLE IF NOT EXISTS operations.transfers_projection (
  id              TEXT        PRIMARY KEY,
  reservation_id  TEXT        NOT NULL,
  vehicle_id      TEXT        NOT NULL,
  conductor_id    TEXT        NOT NULL,
  status          TEXT        NOT NULL,
  origin          TEXT,
  destination     TEXT,
  category_id     TEXT,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transfers_projection_status
  ON operations.transfers_projection (status);

-- Proyección de alertas de tracking (para F18 — alertas por traslado)
CREATE TABLE IF NOT EXISTS operations.alerts_projection (
  id          TEXT        PRIMARY KEY,
  transfer_id TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_projection_transfer
  ON operations.alerts_projection (transfer_id);
