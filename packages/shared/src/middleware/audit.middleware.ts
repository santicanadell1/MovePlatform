import { randomUUID } from 'crypto';

import { NextFunction, Request, Response } from 'express';

import { runWithTrace } from '../logger/trace-context';

export interface AuditLogger {
  info(message: string, meta: Record<string, unknown>): void;
  warn(message: string, meta: Record<string, unknown>): void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}

export const createAuditMiddleware = (logger: AuditLogger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = randomUUID();
    req.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);

    const startedAt = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startedAt;
      const status = res.statusCode;
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

      const meta: Record<string, unknown> = {
        traceId,
        method: req.method,
        url: req.originalUrl,
        statusCode: status,
        durationMs: duration,
        ip,
        userId: req.user?.uid ?? null,
        role: req.user?.role ?? null,
      };

      if (status === 401 || status === 403) {
        logger.warn('Unauthorized access attempt', meta);
      } else if (req.user) {
        logger.info('Authenticated request', meta);
      }
    });

    runWithTrace(traceId, () => next());
  };
};
