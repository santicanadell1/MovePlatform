/**
 * R2 — Latencia de consultas y listados bajo carga base
 *
 * SLA:
 *   consultas (GET /reservas con filtro):  p95 < 300 ms
 *   listados  (GET /traslados):            p95 < 500 ms
 *
 * Carga: 100 req/min (baseline según spec — 100 reservas/min + 50 GPS concurrentes)
 *
 * Endpoints:
 *   GET http://localhost:3001/v1/reservas      (booking-service)
 *   GET http://localhost:3002/api/operaciones/traslados  (operations-service)
 *
 * Prerequisito: usuarios seeded (operador1@move.uy / Operador1234!)
 */

import http from 'k6/http';
import { check } from 'k6';

import { login } from '../lib/auth.js';
import { THRESHOLDS } from '../lib/thresholds.js';

const BOOKING_URL = __ENV.K6_BOOKING_URL || 'http://localhost:3001';
const OPERATIONS_URL = __ENV.K6_OPERATIONS_URL || 'http://localhost:3002';

export const options = {
  scenarios: {
    mixed: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: THRESHOLDS.r2,
};

export function setup() {
  const token = login(BOOKING_URL, 'operador1@move.uy', 'Operador1234!');
  return { token };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  if (__VU % 2 === 0) {
    // Consulta con filtro de estado
    const res = http.get(`${BOOKING_URL}/v1/reservas?status=QUOTED&limit=20`, {
      headers,
      tags: { type: 'consulta' },
    });
    check(res, { 'consulta 200': (r) => r.status === 200 });
  } else {
    // Listado de traslados (operations-service)
    const res = http.get(`${OPERATIONS_URL}/api/operaciones/traslados`, {
      headers,
      tags: { type: 'listado' },
    });
    check(res, { 'listado 200': (r) => r.status === 200 });
  }
}
