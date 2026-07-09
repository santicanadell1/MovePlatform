import CircuitBreaker from 'opossum';

import type { IPaymentGateway, PaymentResult } from '../../domain/ports/payment-gateway.port';

export class CircuitBreakerPaymentGateway implements IPaymentGateway {
  private readonly breaker: CircuitBreaker<[number, string, string], PaymentResult>;

  constructor(inner: IPaymentGateway) {
    this.breaker = new CircuitBreaker(
      (amount: number, currency: string, reservationId: string) =>
        inner.charge(amount, currency, reservationId),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
    );
  }

  charge(amount: number, currency: string, reservationId: string): Promise<PaymentResult> {
    return this.breaker.fire(amount, currency, reservationId);
  }
}
