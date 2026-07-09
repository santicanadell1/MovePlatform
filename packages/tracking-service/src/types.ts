export const TYPES = {
  // Clients
  PrismaClient: Symbol.for('PrismaClient'),
  RedisClient: Symbol.for('RedisClient'),
  PgPool: Symbol.for('PgPool'),

  // Repositories
  TransferRepository: Symbol.for('TransferRepository'),
  GpsPointRepository: Symbol.for('GpsPointRepository'),
  AlertRepository: Symbol.for('AlertRepository'),
  IncidentRepository: Symbol.for('IncidentRepository'),
  ZoneRepository: Symbol.for('ZoneRepository'),
  VehicleRegistryRepository: Symbol.for('VehicleRegistryRepository'),

  // Ports
  AuthService: Symbol.for('AuthService'),
  EventPublisher: Symbol.for('EventPublisher'),
  CacheService: Symbol.for('CacheService'),
  GpsQueueService: Symbol.for('GpsQueueService'),
  RabbitMQChannel: Symbol.for('RabbitMQChannel'),

  // Pipeline filters (P1-P7)
  GpsValidationFilter: Symbol.for('GpsValidationFilter'),
  GpsEnrichmentFilter: Symbol.for('GpsEnrichmentFilter'),
  GpsPersistenceFilter: Symbol.for('GpsPersistenceFilter'),
  GpsGeofenceFilter: Symbol.for('GpsGeofenceFilter'),
  GpsStopDetectionFilter: Symbol.for('GpsStopDetectionFilter'),
  GpsAlertGenerationFilter: Symbol.for('GpsAlertGenerationFilter'),
  GpsSseBroadcastFilter: Symbol.for('GpsSseBroadcastFilter'),

  // Use Cases
  ReceiveGpsPointUseCase: Symbol.for('ReceiveGpsPointUseCase'),
  StartTransferUseCase: Symbol.for('StartTransferUseCase'),
  FinishTransferUseCase: Symbol.for('FinishTransferUseCase'),
  ReportIncidentUseCase: Symbol.for('ReportIncidentUseCase'),
  GetIncidentsByTransferUseCase: Symbol.for('GetIncidentsByTransferUseCase'),
  GetTransferStatusUseCase: Symbol.for('GetTransferStatusUseCase'),
  GetAlertsUseCase: Symbol.for('GetAlertsUseCase'),

  // Controllers
  GpsController: Symbol.for('GpsController'),
  TransferController: Symbol.for('TransferController'),
  IncidentController: Symbol.for('IncidentController'),
  SseController: Symbol.for('SseController'),
} as const;
