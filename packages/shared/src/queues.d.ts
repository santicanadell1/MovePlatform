export declare const GPS_QUEUES: {
  readonly P1_VALIDATION: 'gps:p1:validation';
  readonly P2_ENRICHMENT: 'gps:p2:enrichment';
  readonly P3_PERSISTENCE: 'gps:p3:persistence';
  readonly P4_GEOFENCE: 'gps:p4:geofence';
  readonly P5_STOP_DETECTION: 'gps:p5:stop-detection';
  readonly P6_ALERT_GENERATION: 'gps:p6:alert-generation';
  readonly P7_SSE_BROADCAST: 'gps:p7:sse-broadcast';
};
export declare const AI_QUEUES: {
  readonly CATEGORIZATION: 'ai:categorization';
};
export declare const RABBITMQ_EXCHANGES: {
  readonly MOVE_EVENTS: 'move.events';
};
export declare const RABBITMQ_ROUTING_KEYS: {
  readonly RESERVATION_UNCLASSIFIED: 'reservation.unclassified';
  readonly RESERVATION_CLASSIFIED: 'reservation.classified';
  readonly ALERT_CREATED: 'alert.created';
  readonly INCIDENT_REPORTED: 'incident.reported';
};
export declare const RABBITMQ_QUEUES: {
  readonly AI_WORKER_UNCLASSIFIED: 'ai-worker.reservation.unclassified';
  readonly OPERATIONS_CLASSIFIED: 'operations.reservation.classified';
  readonly OPERATIONS_ALERT: 'operations.alert.created';
  readonly BOOKING_INCIDENT: 'booking.incident.reported';
};
//# sourceMappingURL=queues.d.ts.map
