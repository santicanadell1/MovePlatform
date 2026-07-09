import winston from 'winston';
import { getTraceId } from '@move/shared';

const addTraceId = winston.format((info) => {
  const traceId = getTraceId();
  if (traceId !== undefined) {
    return { ...info, traceId };
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    addTraceId(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'operations-service',
    version: process.env.npm_package_version ?? '1.0.0',
  },
  transports: [new winston.transports.Console()],
});
