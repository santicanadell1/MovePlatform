import { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de requests HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total de requests HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const reservationsCreatedTotal = new Counter({
  name: 'reservations_created_total',
  help: 'Total de reservas creadas',
  labelNames: ['client_type'],
  registers: [register],
});

export const authCircuitBreakerState = new Gauge({
  name: 'auth_circuit_breaker_state',
  help: 'Estado CB de auth: 0=cerrado, 0.5=half-open, 1=abierto',
  labelNames: ['breaker'],
  registers: [register],
});

export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const routeRecord = req.route as { path: string } | undefined;
    const route = routeRecord ? `${req.baseUrl}${routeRecord.path}` : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  next();
};
