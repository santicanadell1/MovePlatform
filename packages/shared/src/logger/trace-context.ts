import { AsyncLocalStorage } from 'node:async_hooks';

interface TraceStore {
  readonly traceId: string;
}

const traceStorage = new AsyncLocalStorage<TraceStore>();

export const runWithTrace = (traceId: string, fn: () => void): void => {
  traceStorage.run({ traceId }, fn);
};

export const getTraceId = (): string | undefined => {
  return traceStorage.getStore()?.traceId;
};
