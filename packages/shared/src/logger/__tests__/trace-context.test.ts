import { getTraceId, runWithTrace } from '../trace-context';

describe('trace-context', () => {
  it('getTraceId() retorna undefined fuera de runWithTrace', () => {
    expect(getTraceId()).toBeUndefined();
  });

  it('getTraceId() retorna el traceId dentro del callback', () => {
    let captured: string | undefined;
    runWithTrace('test-id-1', () => {
      captured = getTraceId();
    });
    expect(captured).toBe('test-id-1');
  });

  it('getTraceId() retorna undefined después del callback', () => {
    runWithTrace('test-id-2', () => {});
    expect(getTraceId()).toBeUndefined();
  });

  it('contextos paralelos son aislados entre sí', async () => {
    const results: Array<string | undefined> = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        runWithTrace('trace-A', () => {
          setImmediate(() => {
            results.push(getTraceId());
            resolve();
          });
        });
      }),
      new Promise<void>((resolve) => {
        runWithTrace('trace-B', () => {
          setImmediate(() => {
            results.push(getTraceId());
            resolve();
          });
        });
      }),
    ]);

    expect(results).toHaveLength(2);
    expect(results).toContain('trace-A');
    expect(results).toContain('trace-B');
  });
});
