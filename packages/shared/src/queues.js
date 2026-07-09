'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RABBITMQ_QUEUES =
  exports.RABBITMQ_ROUTING_KEYS =
  exports.RABBITMQ_EXCHANGES =
  exports.AI_QUEUES =
  exports.GPS_QUEUES =
    void 0;
exports.GPS_QUEUES = {
  P1_VALIDATION: 'gps:p1:validation',
  P2_ENRICHMENT: 'gps:p2:enrichment',
  P3_PERSISTENCE: 'gps:p3:persistence',
  P4_GEOFENCE: 'gps:p4:geofence',
  P5_STOP_DETECTION: 'gps:p5:stop-detection',
  P6_ALERT_GENERATION: 'gps:p6:alert-generation',
  P7_SSE_BROADCAST: 'gps:p7:sse-broadcast',
};
exports.AI_QUEUES = {
  CATEGORIZATION: 'ai:categorization',
};
exports.RABBITMQ_EXCHANGES = {
  MOVE_EVENTS: 'move.events',
};
exports.RABBITMQ_ROUTING_KEYS = {
  RESERVATION_UNCLASSIFIED: 'reservation.unclassified',
  RESERVATION_CLASSIFIED: 'reservation.classified',
  ALERT_CREATED: 'alert.created',
  INCIDENT_REPORTED: 'incident.reported',
};
exports.RABBITMQ_QUEUES = {
  AI_WORKER_UNCLASSIFIED: 'ai-worker.reservation.unclassified',
  OPERATIONS_CLASSIFIED: 'operations.reservation.classified',
  OPERATIONS_ALERT: 'operations.alert.created',
  BOOKING_INCIDENT: 'booking.incident.reported',
};
//# sourceMappingURL=queues.js.map
