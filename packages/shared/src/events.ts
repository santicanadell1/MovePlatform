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

export interface ReservationConfirmedEvent extends DomainEvent {
  readonly reservationId: string;
  readonly scheduledDate: string; // YYYY-MM-DD
  readonly origin: string;
  readonly destination: string;
  readonly goodsSummary: ReadonlyArray<{ readonly size: string; readonly quantity: number }>;
  readonly categoryId: string | null;
}

export interface TransferStartedEvent extends DomainEvent {
  readonly transferId: string;
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
  readonly startedAt: string;
}

export interface TransferCompletedEvent extends DomainEvent {
  readonly transferId: string;
  readonly reservationId: string;
  readonly finishedAt: string;
}

export interface ReservationAssignedEvent extends DomainEvent {
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
  readonly assignedAt: string;
}

export interface VehicleRegisteredEvent extends DomainEvent {
  readonly vehicleId: string;
  readonly gpsDeviceId: string | null;
}

export interface ZoneCreatedEvent extends DomainEvent {
  readonly zoneId: string;
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geojson: string; // GeoJSON Polygon serializado
}

export interface ZoneUpdatedEvent extends DomainEvent {
  readonly zoneId: string;
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geojson: string;
}

export interface ZoneDeletedEvent extends DomainEvent {
  readonly zoneId: string;
}
