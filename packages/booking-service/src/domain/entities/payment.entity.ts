import { PaymentStatus } from '@move/shared';

export interface PaymentProps {
  readonly id: string;
  readonly reservationId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly provider: string;
  readonly providerTransactionId: string | null;
  readonly attemptedAt: Date;
  readonly completedAt: Date | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

export class Payment {
  readonly id: string;
  readonly reservationId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly provider: string;
  readonly providerTransactionId: string | null;
  readonly attemptedAt: Date;
  readonly completedAt: Date | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;

  private constructor(props: PaymentProps) {
    this.id = props.id;
    this.reservationId = props.reservationId;
    this.amount = props.amount;
    this.currency = props.currency;
    this.status = props.status;
    this.provider = props.provider;
    this.providerTransactionId = props.providerTransactionId;
    this.attemptedAt = props.attemptedAt;
    this.completedAt = props.completedAt;
    this.errorMessage = props.errorMessage;
    this.createdAt = props.createdAt;
  }

  static create(props: PaymentProps): Payment {
    return new Payment(props);
  }

  withStatus(status: PaymentStatus, completedAt?: Date, errorMessage?: string): Payment {
    return Payment.create({
      ...this,
      status,
      completedAt: completedAt ?? this.completedAt,
      errorMessage: errorMessage ?? this.errorMessage,
    });
  }
}
