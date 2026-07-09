import { injectable, inject } from 'inversify';
import { PaymentStatus } from '@move/shared';

import { Payment } from '../../domain/entities/payment.entity';
import type { IPaymentRepository } from '../../domain/ports/payment.repository.port';
import { PrismaClient } from '../../generated/client';

function toPayment(row: {
  id: string;
  reservationId: string;
  amount: { toNumber(): number };
  currency: string;
  status: string;
  provider: string;
  providerTransactionId: string | null;
  attemptedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}): Payment {
  return Payment.create({
    id: row.id,
    reservationId: row.reservationId,
    amount: row.amount.toNumber(),
    currency: row.currency,
    status: row.status as PaymentStatus,
    provider: row.provider,
    providerTransactionId: row.providerTransactionId,
    attemptedAt: row.attemptedAt,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  });
}

@injectable()
export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async save(payment: Payment): Promise<Payment> {
    await this.prisma.payment.create({
      data: {
        id: payment.id,
        reservationId: payment.reservationId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        providerTransactionId: payment.providerTransactionId ?? undefined,
        attemptedAt: payment.attemptedAt,
        completedAt: payment.completedAt ?? undefined,
        errorMessage: payment.errorMessage ?? undefined,
      },
    });
    return payment;
  }

  async findByReservationId(reservationId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { reservationId } });
    return row ? toPayment(row) : null;
  }
}
