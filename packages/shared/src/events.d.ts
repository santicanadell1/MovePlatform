import { AlertType } from './enums';
export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: string;
}
export interface ReservationUnclassifiedEvent extends DomainEvent {
  readonly reservationId: string;
  readonly clientId: string;
  readonly clientEmail: string;
  readonly goodDescription: string;
}
export interface ReservationClassifiedEvent extends DomainEvent {
  readonly reservationId: string;
  readonly categoryId: string;
  readonly categoryName: string;
}
export interface AlertCreatedEvent extends DomainEvent {
  readonly alertId: string;
  readonly transferId: string;
  readonly type: AlertType;
  readonly lat: number;
  readonly lng: number;
  readonly message: string;
}
export interface IncidentReportedEvent extends DomainEvent {
  readonly incidentId: string;
  readonly transferId: string;
  readonly conductorId: string;
  readonly description: string;
}
//# sourceMappingURL=events.d.ts.map
