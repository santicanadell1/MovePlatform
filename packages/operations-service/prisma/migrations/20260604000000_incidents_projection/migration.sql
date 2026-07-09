-- Proyección de incidentes de tracking (para visibilidad del operador)
SET search_path TO operations, public;

CREATE TABLE IF NOT EXISTS operations.incidents_projection (
  id            TEXT        PRIMARY KEY,
  transfer_id   TEXT        NOT NULL,
  conductor_id  TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_projection_transfer
  ON operations.incidents_projection (transfer_id);
