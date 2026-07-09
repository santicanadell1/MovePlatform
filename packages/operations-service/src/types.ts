export const TYPES = {
  // Repositories
  CategoryRepository: Symbol.for('CategoryRepository'),
  ZoneRepository: Symbol.for('ZoneRepository'),
  VehicleRepository: Symbol.for('VehicleRepository'),
  UserRepository: Symbol.for('UserRepository'),
  PricingRuleRepository: Symbol.for('PricingRuleRepository'),
  ReservationAssignmentRepository: Symbol.for('ReservationAssignmentRepository'),
  ActiveTransfersRepository: Symbol.for('ActiveTransfersRepository'),

  // Ports
  AuthService: Symbol.for('AuthService'),
  AuthVerifier: Symbol.for('AuthVerifier'),
  PgPool: Symbol.for('PgPool'),
  EventPublisher: Symbol.for('EventPublisher'),
  EventConsumer: Symbol.for('EventConsumer'),
  RabbitMQChannel: Symbol.for('RabbitMQChannel'),

  // Use Cases
  CreateCategoryUseCase: Symbol.for('CreateCategoryUseCase'),
  UpdateCategoryUseCase: Symbol.for('UpdateCategoryUseCase'),
  DeleteCategoryUseCase: Symbol.for('DeleteCategoryUseCase'),
  GetCategoriesUseCase: Symbol.for('GetCategoriesUseCase'),
  CreateZoneUseCase: Symbol.for('CreateZoneUseCase'),
  UpdateZoneUseCase: Symbol.for('UpdateZoneUseCase'),
  DeleteZoneUseCase: Symbol.for('DeleteZoneUseCase'),
  GetZonesUseCase: Symbol.for('GetZonesUseCase'),
  CreateVehicleUseCase: Symbol.for('CreateVehicleUseCase'),
  GetVehiclesUseCase: Symbol.for('GetVehiclesUseCase'),
  UpdateVehicleUseCase: Symbol.for('UpdateVehicleUseCase'),
  GetUsersUseCase: Symbol.for('GetUsersUseCase'),
  UpdateUserStatusUseCase: Symbol.for('UpdateUserStatusUseCase'),
  AssignReservationUseCase: Symbol.for('AssignReservationUseCase'),
  GetActiveTransfersUseCase: Symbol.for('GetActiveTransfersUseCase'),
  ClassifyReservationUseCase: Symbol.for('ClassifyReservationUseCase'),

  // Controllers
  CategoryController: Symbol.for('CategoryController'),
  ZoneController: Symbol.for('ZoneController'),
  VehicleController: Symbol.for('VehicleController'),
  UserController: Symbol.for('UserController'),
  OperationsController: Symbol.for('OperationsController'),
} as const;
