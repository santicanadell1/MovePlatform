export const GPS_QUEUES = {
  P1_VALIDATION: 'gps:p1:validation',
  P2_ENRICHMENT: 'gps:p2:enrichment',
  P3_PERSISTENCE: 'gps:p3:persistence',
  P4_GEOFENCE: 'gps:p4:geofence',
  P5_STOP_DETECTION: 'gps:p5:stop-detection',
  P6_ALERT_GENERATION: 'gps:p6:alert-generation',
  P7_SSE_BROADCAST: 'gps:p7:sse-broadcast',
} as const;

export const AI_QUEUES = {
  CATEGORIZATION: 'ai:categorization',
} as const;

export const RABBITMQ_EXCHANGES = {
  MOVE_EVENTS: 'move.events',
  MOVE_DLX: 'move.dlx',
} as const;

export const RABBITMQ_ROUTING_KEYS = {
  RESERVATION_UNCLASSIFIED: 'reservation.unclassified',
  RESERVATION_CLASSIFIED: 'reservation.classified',
  ALERT_CREATED: 'alert.created',
  INCIDENT_REPORTED: 'incident.reported',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  TRANSFER_STARTED: 'transfer.started',
  TRANSFER_COMPLETED: 'transfer.completed',
  RESERVATION_ASSIGNED: 'reservation.assigned',
  VEHICLE_REGISTERED: 'vehicle.registered',
  ZONE_CREATED: 'zone.created',
  ZONE_UPDATED: 'zone.updated',
  ZONE_DELETED: 'zone.deleted',
} as const;

export interface AiCategorizationJob {
  reservationId: string;
  goodDescription: string;
  categories: Array<{ id: string; name: string; examples?: string[] }>;
}

export const RABBITMQ_QUEUES = {
  AI_WORKER_UNCLASSIFIED: 'ai-worker.reservation.unclassified',
  BOOKING_CLASSIFIED: 'booking.reservation.classified',
  OPERATIONS_CLASSIFIED: 'operations.reservation.classified',
  OPERATIONS_ALERT: 'operations.alert.created',
  OPERATIONS_INCIDENT: 'operations.incident.reported',
  BOOKING_INCIDENT: 'booking.incident.reported',
  OPERATIONS_RESERVATION_CONFIRMED: 'operations.reservation.confirmed',
  OPERATIONS_TRANSFER_STARTED: 'operations.transfer.started',
  OPERATIONS_TRANSFER_COMPLETED: 'operations.transfer.completed',
  BOOKING_RESERVATION_ASSIGNED: 'booking.reservation.assigned',
  BOOKING_TRANSFER_COMPLETED: 'booking.transfer.completed',
  TRACKING_VEHICLE_REGISTERED: 'tracking.vehicle.registered',
  TRACKING_ZONE_CREATED: 'tracking.zone.created',
  TRACKING_ZONE_UPDATED: 'tracking.zone.updated',
  TRACKING_ZONE_DELETED: 'tracking.zone.deleted',
} as const;
