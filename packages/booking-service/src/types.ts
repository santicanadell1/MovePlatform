export const TYPES = {
  // Repositories
  UserRepository: Symbol.for('UserRepository'),
  ClientRepository: Symbol.for('ClientRepository'),
  ReservationRepository: Symbol.for('ReservationRepository'),
  GoodRepository: Symbol.for('GoodRepository'),
  PaymentRepository: Symbol.for('PaymentRepository'),
  CompanyProductRepository: Symbol.for('CompanyProductRepository'),
  CompanyLocationRepository: Symbol.for('CompanyLocationRepository'),
  PricingRuleRepository: Symbol.for('PricingRuleRepository'),

  // Ports (external services)
  AuthService: Symbol.for('AuthService'),
  AuthVerifier: Symbol.for('AuthVerifier'),
  PaymentGateway: Symbol.for('PaymentGateway'),
  EmailService: Symbol.for('EmailService'),
  GeolocationService: Symbol.for('GeolocationService'),
  EventPublisher: Symbol.for('EventPublisher'),
  TopClientsCache: Symbol.for('TopClientsCache'),

  // Application services
  PricingService: Symbol.for('PricingService'),
  ClassificationCascade: Symbol.for('ClassificationCascade'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  CategoryEmbeddingRepository: Symbol.for('CategoryEmbeddingRepository'),

  // Infrastructure clients
  PgPool: Symbol.for('PgPool'),
  RabbitMQChannel: Symbol.for('RabbitMQChannel'),
  AiJobQueue: Symbol.for('AiJobQueue'),
  CategoryRepository: Symbol.for('CategoryRepository'),
  SseManager: Symbol.for('SseManager'),
  SseNotifier: Symbol.for('SseNotifier'),

  // Messaging consumers
  ReservationClassifiedConsumer: Symbol.for('ReservationClassifiedConsumer'),
  ReservationAssignedConsumer: Symbol.for('ReservationAssignedConsumer'),
  TransferCompletedConsumer: Symbol.for('TransferCompletedConsumer'),

  // Use cases (messaging)
  ResumeClassifiedReservationUseCase: Symbol.for('ResumeClassifiedReservationUseCase'),
  ClassifyReservationUseCase: Symbol.for('ClassifyReservationUseCase'),
  CompleteReservationUseCase: Symbol.for('CompleteReservationUseCase'),

  // Use Cases
  RegisterUserUseCase: Symbol.for('RegisterUserUseCase'),
  LoginUseCase: Symbol.for('LoginUseCase'),
  CreateReservationUseCase: Symbol.for('CreateReservationUseCase'),
  CreateParticularReservationUseCase: Symbol.for('CreateParticularReservationUseCase'),
  QuoteReservationUseCase: Symbol.for('QuoteReservationUseCase'),
  PayReservationUseCase: Symbol.for('PayReservationUseCase'),
  GetReservationsUseCase: Symbol.for('GetReservationsUseCase'),
  RejectReservationUseCase: Symbol.for('RejectReservationUseCase'),
  CreateCompanyProductUseCase: Symbol.for('CreateCompanyProductUseCase'),
  ListCompanyProductsUseCase: Symbol.for('ListCompanyProductsUseCase'),
  UpdateCompanyProductUseCase: Symbol.for('UpdateCompanyProductUseCase'),
  DeleteCompanyProductUseCase: Symbol.for('DeleteCompanyProductUseCase'),
  CreateCompanyLocationUseCase: Symbol.for('CreateCompanyLocationUseCase'),
  ListCompanyLocationsUseCase: Symbol.for('ListCompanyLocationsUseCase'),
  UpdateCompanyLocationUseCase: Symbol.for('UpdateCompanyLocationUseCase'),
  DeleteCompanyLocationUseCase: Symbol.for('DeleteCompanyLocationUseCase'),
  RecalculateTopClientsJob: Symbol.for('RecalculateTopClientsJob'),

  // Controllers
  AuthController: Symbol.for('AuthController'),
  ClientController: Symbol.for('ClientController'),
  ReservationController: Symbol.for('ReservationController'),
  CompanyProductController: Symbol.for('CompanyProductController'),
  CompanyLocationController: Symbol.for('CompanyLocationController'),
} as const;
