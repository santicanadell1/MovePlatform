export interface SseNotification {
  reservationId: string;
  goodDescription: string;
  clientEmail: string;
  occurredAt: string;
}

export interface ISseNotifier {
  notify(event: SseNotification): Promise<void>;
}
