import type { AuthPayload, IAuthVerifier } from '@move/shared';
import CircuitBreaker from 'opossum';

import { logger } from '../logger';
import { authCircuitBreakerState } from '../metrics/metrics';

export class CircuitBreakerAuthVerifier implements IAuthVerifier {
  private readonly breaker: CircuitBreaker<[string], AuthPayload>;

  constructor(inner: IAuthVerifier) {
    this.breaker = new CircuitBreaker((token: string) => inner.verifyToken(token), {
      timeout: 2000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    this.breaker.on('open', () => {
      authCircuitBreakerState.set({ breaker: 'auth-verifier' }, 1);
      logger.warn({ message: 'CB auth-verifier ABIERTO — Firebase no responde' });
    });
    this.breaker.on('halfOpen', () => {
      authCircuitBreakerState.set({ breaker: 'auth-verifier' }, 0.5);
      logger.info({ message: 'CB auth-verifier HALF-OPEN — probando Firebase' });
    });
    this.breaker.on('close', () => {
      authCircuitBreakerState.set({ breaker: 'auth-verifier' }, 0);
      logger.info({ message: 'CB auth-verifier CERRADO — Firebase recuperado' });
    });
  }

  verifyToken(token: string): Promise<AuthPayload> {
    return this.breaker.fire(token);
  }
}
