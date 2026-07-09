export interface RejectionEmailRequest {
  readonly to: string;
  readonly clientName: string;
  readonly reservationId: string;
  readonly itemDescription: string;
}

export interface IEmailService {
  sendRejection(request: RejectionEmailRequest): Promise<void>;
}
