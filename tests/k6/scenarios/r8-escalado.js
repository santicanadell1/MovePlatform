/**
 * R8 — Escalado horizontal: alta carga 50x vía nginx/api-gateway
 *
 * Escenarios:
 *   reservas_alta_carga — 500 req/min (50x baseline) — POST /v1/reservas via gateway
 *   gps_alta_carga      — 250 VUs  (50x baseline)    — POST /api/tracking/gps via gateway
 *
 * Thresholds: mismos SLAs que baseline (R1/R3) — p95 < 600ms reservas, p95 < 5000ms GPS
 *
 * Uso:
 *   # 1 instancia (esperar degradación)
 *   k6 run tests/k6/scenarios/r8-escalado.js
 *
 *   # 2 instancias (esperar restauración de RNF)
 *   docker compose up -d --scale booking-service=2 --scale tracking-service=2
 *   docker compose exec api-gateway nginx -s reload
 *   k6 run tests/k6/scenarios/r8-escalado.js
 *
 * Prerequisito: stack Docker corriendo con docker compose up -d
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import { login } from '../lib/auth.js';
import { makeEmpresaReservaPayload, makeGpsPayload } from '../lib/data.js';
import { THRESHOLDS } from '../lib/thresholds.js';

const GATEWAY_URL = __ENV.K6_GATEWAY_URL || 'http://localhost:8000';

// 5 conductores — rotan entre los 250 VUs de GPS
const CONDUCTORS = [
  { email: 'conductor1@move.uy', password: 'Conductor1234!' },
  { email: 'conductor2@move.uy', password: 'Conductor1234!' },
  { email: 'conductor3@move.uy', password: 'Conductor1234!' },
  { email: 'conductor4@move.uy', password: 'Conductor1234!' },
  { email: 'conductor5@move.uy', password: 'Conductor1234!' },
];

export const options = {
  scenarios: {
    reservas_alta_carga: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1m',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 150,
      tags: { scenario: 'reservas_alta_carga' },
      exec: 'runReservas',
    },
    gps_alta_carga: {
      executor: 'constant-vus',
      vus: 250,
      duration: '3m',
      tags: { scenario: 'gps_alta_carga' },
      exec: 'runGps',
    },
  },
  thresholds: THRESHOLDS.r8,
};

export function setup() {
  // Login de un usuario empresa para reservas (usa el mismo usuario que R1 si ya existe)
  const reservasToken = login(GATEWAY_URL, 'k6-top-1@test.move.uy', 'K6TopPass123!');

  // Obtener productId del usuario empresa via gateway
  const productsRes = http.get(`${GATEWAY_URL}/v1/companies/products`, {
    headers: { Authorization: `Bearer ${reservasToken}` },
  });
  const products = productsRes.json('data');
  const productId = Array.isArray(products) && products.length > 0 ? products[0].id : null;

  // Login de conductores para GPS
  const conductorTokens = CONDUCTORS.map((c) => login(GATEWAY_URL, c.email, c.password));
  const deviceIds = CONDUCTORS.map((_, i) => `conductor-device-${i + 1}`);

  return { reservasToken, productId, conductorTokens, deviceIds };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function runReservas(data) {
  if (!data.productId) return;

  const res = http.post(`${GATEWAY_URL}/v1/reservas`, makeEmpresaReservaPayload(data.productId), {
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${data.reservasToken}` },
  });
  check(res, { 'reserva 201': (r) => r.status === 201 });
}

export function runGps(data) {
  const idx = (__VU - 1) % CONDUCTORS.length;
  const token = data.conductorTokens[idx];
  const deviceId = data.deviceIds[idx];

  const res = http.post(`${GATEWAY_URL}/api/tracking/gps`, makeGpsPayload(deviceId), {
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
      'X-Device-Id': deviceId,
    },
  });
  check(res, { 'gps 202': (r) => r.status === 202 });

  // Simula intervalo real de transmisión GPS por dispositivo
  sleep(0.2);
}
