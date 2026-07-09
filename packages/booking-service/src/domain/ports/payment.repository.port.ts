import type { Payment } from '../entities/payment.entity';

export interface IPaymentRepository {
  save(payment: Payment): Promise<Payment>;
  findByReservationId(reservationId: string): Promise<Payment | null>;
}
