import { v4 as uuidv4 } from 'uuid';
import {
  PaymentStatus,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  ReservationStatus,
  type ReservationConfirmedEvent,
} from '@move/shared';

import { Payment } from '../../domain/entities/payment.entity';
import type { Reservation } from '../../domain/entities/reservation.entity';
import {
  PaymentAlreadyExistsError,
  PaymentGatewayUnavailableError,
  ReservationNotFoundError,
  ReservationNotQuotedError,
  ReservationOwnershipError,
} from '../../domain/errors/reservation.errors';
import type { IEventPublisher } from '../../domain/ports/event-publisher.port';
import type { IPaymentGateway } from '../../domain/ports/payment-gateway.port';
import type { IPaymentRepository } from '../../domain/ports/payment.repository.port';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

export interface PayReservationInput {
  reservationId: string;
  firebaseUid: string;
}

export class PayReservationUseCase {
  constructor(
    private readonly reservationRepo: IReservationRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly userRepo: IUserRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: PayReservationInput): Promise<Payment> {
    const { reservationId, firebaseUid } = input;

    const user = await this.userRepo.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new ReservationNotFoundError(reservationId);
    }

    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new ReservationNotFoundError(reservationId);
    }

    if (reservation.clientId !== user.id) {
      throw new ReservationOwnershipError(reservationId);
    }

    if (reservation.status !== ReservationStatus.QUOTED) {
      throw new ReservationNotQuotedError(reservationId);
    }

    const existing = await this.paymentRepo.findByReservationId(reservationId);
    if (existing) {
      throw new PaymentAlreadyExistsError(reservationId);
    }

    let result;
    try {
      result = await this.paymentGateway.charge(reservation.totalCost!, 'UYU', reservationId);
    } catch {
      await this.reservationRepo.update(reservation.withStatus(ReservationStatus.PENDING_PAYMENT));
      throw new PaymentGatewayUnavailableError();
    }

    const now = new Date();

    if (result.success) {
      const payment = Payment.create({
        id: uuidv4(),
        reservationId,
        amount: reservation.totalCost!,
        currency: 'UYU',
        status: PaymentStatus.APPROVED,
        provider: 'mock',
        providerTransactionId: result.transactionId ?? null,
        attemptedAt: now,
        completedAt: now,
        errorMessage: null,
        createdAt: now,
      });

      await this.paymentRepo.save(payment);
      await this.reservationRepo.update(reservation.withStatus(ReservationStatus.CONFIRMED));

      await this.publishConfirmed(reservationId, reservation, now);

      return payment;
    }

    const payment = Payment.create({
      id: uuidv4(),
      reservationId,
      amount: reservation.totalCost!,
      currency: 'UYU',
      status: PaymentStatus.REJECTED,
      provider: 'mock',
      providerTransactionId: null,
      attemptedAt: now,
      completedAt: now,
      errorMessage: result.errorMessage ?? null,
      createdAt: now,
    });

    await this.paymentRepo.save(payment);
    await this.reservationRepo.update(reservation.withStatus(ReservationStatus.REJECTED));
    return payment;
  }

  private async publishConfirmed(
    reservationId: string,
    reservation: Reservation,
    now: Date,
  ): Promise<void> {
    const withGoods = await this.reservationRepo.findByIdWithGoods(reservationId);
    const goods = withGoods?.goods ?? [];
    const goodsSummary = goods.map((g) => ({
      size: (g.size ?? 'UNKNOWN') as string,
      quantity: g.quantity,
    }));
    const categoryId = goods[0]?.categoryId ?? null;

    const event: ReservationConfirmedEvent = {
      eventId: uuidv4(),
      occurredAt: now.toISOString(),
      reservationId,
      scheduledDate: reservation.scheduledDate.toISOString().split('T')[0],
      origin: reservation.origin,
      destination: reservation.destination,
      goodsSummary,
      categoryId,
    };

    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.RESERVATION_CONFIRMED,
        event,
      );
    } catch {
      // Pago ya procesado; la proyección en operations es eventual consistency aceptada.
    }
  }
}
