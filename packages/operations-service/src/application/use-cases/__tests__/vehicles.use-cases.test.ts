import { Vehicle } from '../../../domain/entities/vehicle.entity';
import {
  DuplicateGpsDeviceIdError,
  DuplicatePlateError,
  VehicleNotFoundError,
} from '../../../domain/errors/vehicle.errors';
import { CreateVehicleUseCase } from '../vehicles/create-vehicle.use-case';
import { GetVehiclesUseCase } from '../vehicles/get-vehicles.use-case';
import { UpdateVehicleUseCase } from '../vehicles/update-vehicle.use-case';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';

import { InMemoryVehicleRepository } from './doubles/in-memory-vehicle.repository';

const noOpPublisher: IEventPublisher = { publish: () => Promise.resolve() };

const makeVehicle = (overrides: Partial<Vehicle> = {}): Vehicle =>
  Vehicle.create({
    id: 'v-1',
    plate: 'ABC 1234',
    type: 'sedan',
    capacity: 4,
    gpsDeviceId: 'gps-1',
    available: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ---------------------------------------------------------------------------
// GetVehiclesUseCase
// ---------------------------------------------------------------------------

describe('GetVehiclesUseCase', () => {
  it('retorna lista vacía cuando no hay vehículos', async () => {
    const repo = new InMemoryVehicleRepository();
    const useCase = new GetVehiclesUseCase(repo);

    const result = await useCase.execute({});

    expect(result).toHaveLength(0);
  });

  it('retorna todos los vehículos sin filtros', async () => {
    const repo = new InMemoryVehicleRepository();
    repo.seed([makeVehicle(), makeVehicle({ id: 'v-2', plate: 'XYZ 9999', type: 'van' })]);
    const useCase = new GetVehiclesUseCase(repo);

    const result = await useCase.execute({});

    expect(result).toHaveLength(2);
  });

  it('filtra por available=true', async () => {
    const repo = new InMemoryVehicleRepository();
    repo.seed([makeVehicle(), makeVehicle({ id: 'v-2', plate: 'XYZ 9999', available: false })]);
    const useCase = new GetVehiclesUseCase(repo);

    const result = await useCase.execute({ available: true });

    expect(result).toHaveLength(1);
    expect(result[0].plate).toBe('ABC 1234');
  });

  it('filtra por type', async () => {
    const repo = new InMemoryVehicleRepository();
    repo.seed([
      makeVehicle({ id: 'v-1', plate: 'ABC 1234', type: 'sedan' }),
      makeVehicle({ id: 'v-2', plate: 'XYZ 9999', type: 'van' }),
    ]);
    const useCase = new GetVehiclesUseCase(repo);

    const result = await useCase.execute({ type: 'van' });

    expect(result).toHaveLength(1);
    expect(result[0].plate).toBe('XYZ 9999');
  });
});

// ---------------------------------------------------------------------------
// CreateVehicleUseCase
// ---------------------------------------------------------------------------

describe('CreateVehicleUseCase', () => {
  let repo: InMemoryVehicleRepository;
  let useCase: CreateVehicleUseCase;

  beforeEach(() => {
    repo = new InMemoryVehicleRepository();
    useCase = new CreateVehicleUseCase(repo, noOpPublisher);
  });

  it('crea un vehículo con available=true por defecto', async () => {
    const result = await useCase.execute({
      plate: 'ABC 1234',
      type: 'sedan',
      capacity: 4,
      gpsDeviceId: 'gps-1',
    });

    expect(result.plate).toBe('ABC 1234');
    expect(result.type).toBe('sedan');
    expect(result.capacity).toBe(4);
    expect(result.gpsDeviceId).toBe('gps-1');
    expect(result.available).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('crea un vehículo sin gpsDeviceId', async () => {
    const result = await useCase.execute({ plate: 'ABC 1234', type: 'sedan', capacity: 4 });

    expect(result.gpsDeviceId).toBeNull();
  });

  it('lanza DuplicatePlateError si la matrícula ya existe', async () => {
    repo.seed([makeVehicle()]);

    await expect(
      useCase.execute({ plate: 'ABC 1234', type: 'van', capacity: 8 }),
    ).rejects.toBeInstanceOf(DuplicatePlateError);
  });

  it('lanza DuplicateGpsDeviceIdError si el gpsDeviceId ya existe', async () => {
    repo.seed([makeVehicle()]);

    await expect(
      useCase.execute({ plate: 'NEW 0001', type: 'sedan', capacity: 4, gpsDeviceId: 'gps-1' }),
    ).rejects.toBeInstanceOf(DuplicateGpsDeviceIdError);
  });
});

// ---------------------------------------------------------------------------
// UpdateVehicleUseCase
// ---------------------------------------------------------------------------

describe('UpdateVehicleUseCase', () => {
  let repo: InMemoryVehicleRepository;
  let useCase: UpdateVehicleUseCase;

  beforeEach(() => {
    repo = new InMemoryVehicleRepository();
    useCase = new UpdateVehicleUseCase(repo);
  });

  it('actualiza la disponibilidad del vehículo', async () => {
    repo.seed([makeVehicle()]);

    const result = await useCase.execute({ vehicleId: 'v-1', available: false });

    expect(result.available).toBe(false);
  });

  it('actualiza type y capacity', async () => {
    repo.seed([makeVehicle()]);

    const result = await useCase.execute({ vehicleId: 'v-1', type: 'van', capacity: 8 });

    expect(result.type).toBe('van');
    expect(result.capacity).toBe(8);
  });

  it('actualiza la matrícula sin conflicto', async () => {
    repo.seed([makeVehicle()]);

    const result = await useCase.execute({ vehicleId: 'v-1', plate: 'NEW 9999' });

    expect(result.plate).toBe('NEW 9999');
  });

  it('lanza VehicleNotFoundError si el vehículo no existe', async () => {
    await expect(
      useCase.execute({ vehicleId: 'no-existe', available: true }),
    ).rejects.toBeInstanceOf(VehicleNotFoundError);
  });

  it('lanza DuplicatePlateError si la nueva matrícula ya la usa otro vehículo', async () => {
    repo.seed([
      makeVehicle({ id: 'v-1', plate: 'ABC 1234' }),
      makeVehicle({ id: 'v-2', plate: 'XYZ 9999', gpsDeviceId: 'gps-2' }),
    ]);

    await expect(useCase.execute({ vehicleId: 'v-1', plate: 'XYZ 9999' })).rejects.toBeInstanceOf(
      DuplicatePlateError,
    );
  });

  it('lanza DuplicateGpsDeviceIdError si el nuevo gpsDeviceId ya lo usa otro vehículo', async () => {
    repo.seed([
      makeVehicle({ id: 'v-1', plate: 'ABC 1234', gpsDeviceId: 'gps-1' }),
      makeVehicle({ id: 'v-2', plate: 'XYZ 9999', gpsDeviceId: 'gps-2' }),
    ]);

    await expect(
      useCase.execute({ vehicleId: 'v-1', gpsDeviceId: 'gps-2' }),
    ).rejects.toBeInstanceOf(DuplicateGpsDeviceIdError);
  });

  it('permite limpiar el gpsDeviceId a null', async () => {
    repo.seed([makeVehicle()]);

    const result = await useCase.execute({ vehicleId: 'v-1', gpsDeviceId: null });

    expect(result.gpsDeviceId).toBeNull();
  });
});
