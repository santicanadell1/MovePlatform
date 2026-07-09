import http from 'k6/http';
import { check } from 'k6';

/**
 * Realiza login en booking-service y retorna el JWT token.
 * @param {string} baseUrl  URL del booking-service, ej: http://localhost:3001
 * @param {string} email
 * @param {string} password
 * @returns {string} JWT token
 */
export function login(baseUrl, email, password) {
  const res = http.post(`${baseUrl}/v1/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) {
    throw new Error(`Login failed for ${email}: HTTP ${String(res.status)} — ${String(res.body)}`);
  }

  return res.json('data.token');
}
