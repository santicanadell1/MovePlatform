import type { IPaymentGateway, PaymentResult } from '../../../../domain/ports/payment-gateway.port';

export type FakePaymentBehavior = 'approve' | 'reject' | 'throw';

export class FakePaymentGateway implements IPaymentGateway {
  behavior: FakePaymentBehavior = 'approve';

  charge(_amount: number, _currency: string, _reservationId: string): Promise<PaymentResult> {
    if (this.behavior === 'throw') {
      return Promise.reject(new Error('gateway unavailable'));
    }
    if (this.behavior === 'reject') {
      return Promise.resolve({ success: false, errorMessage: 'Fondos insuficientes' });
    }
    return Promise.resolve({ success: true, transactionId: 'txn-mock-123' });
  }
}
