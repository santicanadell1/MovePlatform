/**
 * R1 — Latencia de creación de reserva empresa
 *
 * SLA:
 *   top-20 (Redis cache HIT):    p95 < 600 ms
 *   no frecuente (cache MISS):   p95 < 1 000 ms
 *
 * Endpoints:
 *   POST http://localhost:3001/v1/reservas  (booking-service directo)
 *
 * Prerequisito:
 *   pnpm ts-node packages/booking-service/scripts/seed-k6-data.ts
 */

import http from 'k6/http';
import { check } from 'k6';

import { login } from '../lib/auth.js';
import { makeEmpresaReservaPayload } from '../lib/data.js';
import { THRESHOLDS } from '../lib/thresholds.js';

const BOOKING_URL = __ENV.K6_BOOKING_URL || 'http://localhost:3001';

// open() solo en init code (top-level)
const CREDS = JSON.parse(open('../setup/k6-credentials.json'));

export const options = {
  scenarios: {
    top20: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      tags: { scenario: 'top20' },
      exec: 'runTop20',
    },
    cold: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      tags: { scenario: 'cold' },
      exec: 'runCold',
    },
  },
  thresholds: THRESHOLDS.r1,
};

export function setup() {
  return {
    topToken: login(BOOKING_URL, CREDS.topUser.email, CREDS.topUser.password),
    coldToken: login(BOOKING_URL, CREDS.coldUser.email, CREDS.coldUser.password),
    topProductId: CREDS.topProductId,
    coldProductId: CREDS.coldProductId,
  };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function runTop20(data) {
  const res = http.post(
    `${BOOKING_URL}/v1/reservas`,
    makeEmpresaReservaPayload(data.topProductId),
    { headers: { ...JSON_HEADERS, Authorization: `Bearer ${data.topToken}` } },
  );
  check(res, { 'top20 201': (r) => r.status === 201 });
}

export function runCold(data) {
  const res = http.post(
    `${BOOKING_URL}/v1/reservas`,
    makeEmpresaReservaPayload(data.coldProductId),
    { headers: { ...JSON_HEADERS, Authorization: `Bearer ${data.coldToken}` } },
  );
  check(res, { 'cold 201': (r) => r.status === 201 });
}
