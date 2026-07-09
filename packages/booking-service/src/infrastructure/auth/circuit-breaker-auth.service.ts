import type { UserRole } from '@move/shared';
import CircuitBreaker from 'opossum';

import type { IAuthService } from '../../domain/ports/auth.service.port';
import { logger } from '../logger';
import { authCircuitBreakerState } from '../metrics/metrics';

export class CircuitBreakerAuthService implements IAuthService {
  private readonly breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;

  constructor(private readonly inner: IAuthService) {
    this.breaker = new CircuitBreaker((fn: () => Promise<unknown>) => fn(), {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    this.breaker.on('open', () => {
      authCircuitBreakerState.set({ breaker: 'auth-service' }, 1);
      logger.warn({ message: 'CB auth-service ABIERTO — Firebase no responde' });
    });
    this.breaker.on('halfOpen', () => {
      authCircuitBreakerState.set({ breaker: 'auth-service' }, 0.5);
      logger.info({ message: 'CB auth-service HALF-OPEN — probando Firebase' });
    });
    this.breaker.on('close', () => {
      authCircuitBreakerState.set({ breaker: 'auth-service' }, 0);
      logger.info({ message: 'CB auth-service CERRADO — Firebase recuperado' });
    });
  }

  async createUser(email: string, password: string): Promise<{ uid: string }> {
    return this.breaker.fire(() => this.inner.createUser(email, password)) as Promise<{
      uid: string;
    }>;
  }

  async setCustomClaim(uid: string, role: UserRole): Promise<void> {
    return this.breaker.fire(() => this.inner.setCustomClaim(uid, role)) as Promise<void>;
  }

  async signIn(email: string, password: string): Promise<{ token: string; uid: string }> {
    return this.breaker.fire(() => this.inner.signIn(email, password)) as Promise<{
      token: string;
      uid: string;
    }>;
  }

  async deleteUser(uid: string): Promise<void> {
    return this.breaker.fire(() => this.inner.deleteUser(uid)) as Promise<void>;
  }
}
