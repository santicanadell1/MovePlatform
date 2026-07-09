/**
 * SLAs definidos en docs/specs/2026-04-29-move-architecture-design.md
 *
 * R1: POST /v1/reservas (empresa)
 *   - top-20 (Redis cache HIT): p95 < 600 ms
 *   - no frecuente (cache MISS): p95 < 1 000 ms
 *
 * R2: GET endpoints bajo carga base (100 req/min)
 *   - consultas: p95 < 300 ms
 *   - listados: p95 < 500 ms
 *
 * R3: POST /api/tracking/gps (pipeline GPS asíncrono)
 *   - HTTP response: p95 < 5 000 ms
 *   - La latencia real P1-P7 (~2-3 s) se monitorea en Grafana via bull_job_duration_seconds
 */
export const THRESHOLDS = {
  r1: {
    'http_req_duration{scenario:top20}': ['p(95)<600'],
    'http_req_duration{scenario:cold}': ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
  r2: {
    'http_req_duration{type:consulta}': ['p(95)<300'],
    'http_req_duration{type:listado}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  r3: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
  r8: {
    'http_req_duration{scenario:reservas_alta_carga}': ['p(95)<600'],
    'http_req_duration{scenario:gps_alta_carga}': ['p(95)<5000'],
    http_req_failed: ['rate<0.01'],
  },
};
