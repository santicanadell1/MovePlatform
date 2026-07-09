import type { Request, Response } from 'express';

import { createAuditMiddleware, type AuditLogger } from '../audit.middleware';
import { getTraceId } from '../../logger/trace-context';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    method: 'GET',
    originalUrl: '/health',
    headers: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function makeRes(statusCode = 200): Response & {
  _headers: Record<string, string>;
  triggerFinish: () => void;
} {
  const events: Record<string, () => void> = {};
  const headers: Record<string, string> = {};
  const res = {
    _headers: headers,
    statusCode,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    on(event: string, fn: () => void) {
      events[event] = fn;
    },
    triggerFinish() {
      events['finish']?.();
    },
  } as unknown as Response & { _headers: Record<string, string>; triggerFinish: () => void };
  return res;
}

describe('createAuditMiddleware', () => {
  let mockLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
  });

  it('asigna req.traceId como string definido', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq();
    const res = makeRes();

    middleware(req, res, () => {});

    expect(req.traceId).toBeDefined();
    expect(typeof req.traceId).toBe('string');
    expect(req.traceId!.length).toBeGreaterThan(0);
  });

  it('establece el header X-Trace-Id igual a req.traceId', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq();
    const res = makeRes();

    middleware(req, res, () => {});

    expect(res._headers['X-Trace-Id']).toBe(req.traceId);
  });

  it('getTraceId() dentro de next() coincide con req.traceId', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq();
    const res = makeRes();
    let traceIdInsideNext: string | undefined;

    middleware(req, res, () => {
      traceIdInsideNext = getTraceId();
    });

    expect(traceIdInsideNext).toBeDefined();
    expect(traceIdInsideNext).toBe(req.traceId);
  });

  it('loguea warn en 401 al emitir finish', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq();
    const res = makeRes(401);

    middleware(req, res, () => {});
    res.triggerFinish();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unauthorized access attempt',
      expect.objectContaining({ traceId: req.traceId, statusCode: 401 }),
    );
  });

  it('loguea info en request autenticado 200 al emitir finish', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq({
      user: { uid: 'user-1', email: 'a@b.com', role: 'CLIENT_PARTICULAR' } as never,
    });
    const res = makeRes(200);

    middleware(req, res, () => {});
    res.triggerFinish();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Authenticated request',
      expect.objectContaining({ traceId: req.traceId, userId: 'user-1' }),
    );
  });

  it('no loguea nada en request anónimo 200', () => {
    const middleware = createAuditMiddleware(mockLogger);
    const req = makeReq();
    const res = makeRes(200);

    middleware(req, res, () => {});
    res.triggerFinish();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockLogger.info).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
