export interface PaymentResult {
  readonly success: boolean;
  readonly transactionId?: string;
  readonly errorMessage?: string;
}

export interface IPaymentGateway {
  charge(amount: number, currency: string, reservationId: string): Promise<PaymentResult>;
}
