import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';

import type { IPaymentGateway, PaymentResult } from '../../domain/ports/payment-gateway.port';

@injectable()
export class MockPaymentGateway implements IPaymentGateway {
  async charge(amount: number, _currency: string, _reservationId: string): Promise<PaymentResult> {
    if (amount > 500000) {
      await new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('gateway timeout')), 100),
      );
    }

    if (amount > 100000) {
      return { success: false, errorMessage: 'Monto excede el límite permitido' };
    }

    return { success: true, transactionId: `mock-txn-${uuidv4()}` };
  }
}
