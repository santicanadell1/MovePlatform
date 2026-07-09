import { ClientType, UserRole } from '@move/shared';

import { CompanyLocation } from '../../../domain/entities/company-location.entity';
import { User } from '../../../domain/entities/user.entity';
import {
  DuplicateLocationNameError,
  LocationNotFoundError,
  LocationOwnershipError,
} from '../../../domain/errors/company.errors';
import { CreateCompanyLocationUseCase } from '../company-locations/create-company-location.use-case';
import { DeleteCompanyLocationUseCase } from '../company-locations/delete-company-location.use-case';
import { ListCompanyLocationsUseCase } from '../company-locations/list-company-locations.use-case';
import { UpdateCompanyLocationUseCase } from '../company-locations/update-company-location.use-case';

import { InMemoryCompanyLocationRepository } from './doubles/in-memory-company-location.repository';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

const makeUser = (overrides: Partial<User> = {}): User =>
  new User({
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    role: UserRole.CLIENT_EMPRESA,
    type: ClientType.EMPRESA,
    name: 'Empresa SA',
    email: 'empresa@test.com',
    companyName: 'Empresa SA',
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeLocation = (overrides: Partial<CompanyLocation> = {}): CompanyLocation =>
  CompanyLocation.create({
    id: 'loc-1',
    clientId: 'user-1',
    name: 'Deposito Central',
    address: 'Av. 18 de Julio 1234',
    lat: -34.9,
    lng: -56.2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('CreateCompanyLocationUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let locationRepo: InMemoryCompanyLocationRepository;
  let useCase: CreateCompanyLocationUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    locationRepo = new InMemoryCompanyLocationRepository();
    useCase = new CreateCompanyLocationUseCase(locationRepo, userRepo);
  });

  it('crea una ubicación cuando el nombre no existe para ese cliente', async () => {
    await userRepo.save(makeUser());

    const result = await useCase.execute({
      firebaseUid: 'firebase-uid-1',
      name: 'Deposito Central',
      address: 'Av. 18 de Julio 1234',
      lat: -34.9,
      lng: -56.2,
    });

    expect(result.name).toBe('Deposito Central');
    expect(result.clientId).toBe('user-1');
    expect(result.lat).toBe(-34.9);
  });

  it('lanza DuplicateLocationNameError si el nombre ya existe para ese cliente', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([makeLocation()]);

    await expect(
      useCase.execute({
        firebaseUid: 'firebase-uid-1',
        name: 'Deposito Central',
        address: 'Otra dirección',
        lat: -34.0,
        lng: -56.0,
      }),
    ).rejects.toBeInstanceOf(DuplicateLocationNameError);
  });
});

describe('ListCompanyLocationsUseCase', () => {
  it('retorna solo las ubicaciones del cliente autenticado', async () => {
    const userRepo = new InMemoryUserRepository();
    const locationRepo = new InMemoryCompanyLocationRepository();
    await userRepo.save(makeUser());
    locationRepo.seed([
      makeLocation({ id: 'loc-1', clientId: 'user-1', name: 'Deposito A' }),
      makeLocation({ id: 'loc-2', clientId: 'otro-user', name: 'Deposito B' }),
    ]);

    const useCase = new ListCompanyLocationsUseCase(locationRepo, userRepo);
    const result = await useCase.execute('firebase-uid-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Deposito A');
  });
});

describe('UpdateCompanyLocationUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let locationRepo: InMemoryCompanyLocationRepository;
  let useCase: UpdateCompanyLocationUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    locationRepo = new InMemoryCompanyLocationRepository();
    useCase = new UpdateCompanyLocationUseCase(locationRepo, userRepo);
  });

  it('actualiza nombre y dirección de la ubicación', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([makeLocation()]);

    const result = await useCase.execute({
      firebaseUid: 'firebase-uid-1',
      locationId: 'loc-1',
      name: 'Deposito Norte',
      address: 'Av. Italia 500',
      lat: -34.8,
      lng: -56.1,
    });

    expect(result.name).toBe('Deposito Norte');
    expect(result.address).toBe('Av. Italia 500');
  });

  it('lanza LocationNotFoundError si la ubicación no existe', async () => {
    await userRepo.save(makeUser());

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'no-existe', name: 'X' }),
    ).rejects.toBeInstanceOf(LocationNotFoundError);
  });

  it('lanza LocationOwnershipError si la ubicación pertenece a otro cliente', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([makeLocation({ clientId: 'otro-user' })]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'loc-1', name: 'X' }),
    ).rejects.toBeInstanceOf(LocationOwnershipError);
  });

  it('lanza DuplicateLocationNameError si el nuevo nombre ya existe', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([
      makeLocation({ id: 'loc-1', name: 'Deposito A' }),
      makeLocation({ id: 'loc-2', name: 'Deposito B' }),
    ]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'loc-1', name: 'Deposito B' }),
    ).rejects.toBeInstanceOf(DuplicateLocationNameError);
  });
});

describe('DeleteCompanyLocationUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let locationRepo: InMemoryCompanyLocationRepository;
  let useCase: DeleteCompanyLocationUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    locationRepo = new InMemoryCompanyLocationRepository();
    useCase = new DeleteCompanyLocationUseCase(locationRepo, userRepo);
  });

  it('elimina la ubicación correctamente', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([makeLocation()]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'loc-1' }),
    ).resolves.toBeUndefined();
  });

  it('lanza LocationNotFoundError si la ubicación no existe', async () => {
    await userRepo.save(makeUser());

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'no-existe' }),
    ).rejects.toBeInstanceOf(LocationNotFoundError);
  });

  it('lanza LocationOwnershipError si la ubicación pertenece a otro cliente', async () => {
    await userRepo.save(makeUser());
    locationRepo.seed([makeLocation({ clientId: 'otro-user' })]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', locationId: 'loc-1' }),
    ).rejects.toBeInstanceOf(LocationOwnershipError);
  });
});
