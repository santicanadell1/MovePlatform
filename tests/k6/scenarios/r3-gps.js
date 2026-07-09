/**
 * R3 — Latencia del pipeline GPS
 *
 * SLA: p95 < 5 000 ms (HTTP response de POST /api/tracking/gps)
 *
 * El endpoint POST /gps es asíncrono: acepta el punto en una Bull queue y responde 202
 * de inmediato. El pipeline real P1-P7 (~2-3 s) se monitorea en Grafana via
 * bull_job_duration_seconds (histogram de prom-client en tracking-service).
 *
 * Carga: 50 VUs concurrentes (simula 50 conductores transmitiendo GPS en paralelo)
 *
 * Endpoints:
 *   POST http://localhost:3003/api/tracking/gps  (tracking-service)
 *
 * Prerequisito: usuarios conductor{1..5}@move.uy seeded (seed-privileged-users.ts)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import { login } from '../lib/auth.js';
import { makeGpsPayload } from '../lib/data.js';
import { THRESHOLDS } from '../lib/thresholds.js';

const BOOKING_URL = __ENV.K6_BOOKING_URL || 'http://localhost:3001';
const TRACKING_URL = __ENV.K6_TRACKING_URL || 'http://localhost:3003';

// 5 conductores seeded; los 50 VUs rotan entre ellos
const CONDUCTORS = [
  { email: 'conductor1@move.uy', password: 'Conductor1234!' },
  { email: 'conductor2@move.uy', password: 'Conductor1234!' },
  { email: 'conductor3@move.uy', password: 'Conductor1234!' },
  { email: 'conductor4@move.uy', password: 'Conductor1234!' },
  { email: 'conductor5@move.uy', password: 'Conductor1234!' },
];

export const options = {
  scenarios: {
    gps: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: THRESHOLDS.r3,
};

export function setup() {
  const tokens = CONDUCTORS.map((c) => login(BOOKING_URL, c.email, c.password));
  // deviceId por conductor (coincide con el VU index mod 5)
  const deviceIds = CONDUCTORS.map((_, i) => `conductor-device-${i + 1}`);
  return { tokens, deviceIds };
}

export default function (data) {
  const idx = (__VU - 1) % CONDUCTORS.length;
  const token = data.tokens[idx];
  const deviceId = data.deviceIds[idx];

  const res = http.post(`${TRACKING_URL}/api/tracking/gps`, makeGpsPayload(deviceId), {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });

  check(res, { 'gps 202': (r) => r.status === 202 });

  // Simula intervalo real de transmisión GPS (~10 s por dispositivo dividido entre 50 VUs)
  sleep(0.2);
}
