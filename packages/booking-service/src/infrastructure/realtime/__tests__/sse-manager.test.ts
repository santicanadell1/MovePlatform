import type { Response } from 'express';

import type { SseNotification } from '../../../domain/ports/sse-notifier.port';
import { SseManager } from '../sse-manager';

interface FakeRes {
  write: jest.Mock;
  on: jest.Mock;
}

const toRes = (f: FakeRes): Response => f as unknown as Response;

const makeNotification = (): SseNotification => ({
  reservationId: 'res-1',
  goodDescription: 'televisor',
  clientEmail: 'cliente@move.uy',
  occurredAt: new Date().toISOString(),
});

const makeFakeRes = (): FakeRes => ({ write: jest.fn(), on: jest.fn() });

describe('SseManager', () => {
  it('addConnection registra la respuesta y retorna un id', () => {
    const manager = new SseManager();
    const res = makeFakeRes();

    const id = manager.addConnection(toRes(res));

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('push escribe el evento a todas las conexiones activas', () => {
    const manager = new SseManager();
    const res1 = makeFakeRes();
    const res2 = makeFakeRes();
    manager.addConnection(toRes(res1));
    manager.addConnection(toRes(res2));

    manager.push(makeNotification());

    expect(res1.write).toHaveBeenCalledTimes(1);
    expect(res2.write).toHaveBeenCalledTimes(1);
    const writeCalls = res1.write.mock.calls as [string][];
    const written = writeCalls[0]?.[0] ?? '';
    expect(written).toContain('data:');
    expect(written).toContain('res-1');
  });

  it('removeConnection excluye la respuesta del broadcast', () => {
    const manager = new SseManager();
    const res = makeFakeRes();
    const id = manager.addConnection(toRes(res));

    manager.removeConnection(id);
    manager.push(makeNotification());

    expect(res.write).not.toHaveBeenCalled();
  });

  it('el evento close en Response elimina la conexión automáticamente', () => {
    const manager = new SseManager();
    const res = makeFakeRes();
    manager.addConnection(toRes(res));

    const onCalls = res.on.mock.calls as [string, () => void][];
    const closeHandler = onCalls.find(([event]) => event === 'close')?.[1];
    expect(closeHandler).toBeDefined();
    closeHandler!();

    manager.push(makeNotification());
    expect(res.write).not.toHaveBeenCalled();
  });
});
