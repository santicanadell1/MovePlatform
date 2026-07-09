import type { Payment } from '../../../../domain/entities/payment.entity';
import type { IPaymentRepository } from '../../../../domain/ports/payment.repository.port';

export class InMemoryPaymentRepository implements IPaymentRepository {
  private readonly payments = new Map<string, Payment>();

  save(payment: Payment): Promise<Payment> {
    this.payments.set(payment.reservationId, payment);
    return Promise.resolve(payment);
  }

  findByReservationId(reservationId: string): Promise<Payment | null> {
    return Promise.resolve(this.payments.get(reservationId) ?? null);
  }
}
