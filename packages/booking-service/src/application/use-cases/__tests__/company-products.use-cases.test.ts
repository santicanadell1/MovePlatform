import { ClientType, UserRole } from '@move/shared';

import { CompanyProduct } from '../../../domain/entities/company-product.entity';
import { User } from '../../../domain/entities/user.entity';
import {
  DuplicateProductNameError,
  ProductNotFoundError,
  ProductOwnershipError,
} from '../../../domain/errors/company.errors';
import { CreateCompanyProductUseCase } from '../company-products/create-company-product.use-case';
import { DeleteCompanyProductUseCase } from '../company-products/delete-company-product.use-case';
import { ListCompanyProductsUseCase } from '../company-products/list-company-products.use-case';
import { UpdateCompanyProductUseCase } from '../company-products/update-company-product.use-case';

import { InMemoryCompanyProductRepository } from './doubles/in-memory-company-product.repository';
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

const makeProduct = (overrides: Partial<CompanyProduct> = {}): CompanyProduct =>
  CompanyProduct.create({
    id: 'prod-1',
    clientId: 'user-1',
    name: 'Monitor',
    categoryId: 'cat-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('CreateCompanyProductUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let productRepo: InMemoryCompanyProductRepository;
  let useCase: CreateCompanyProductUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    productRepo = new InMemoryCompanyProductRepository();
    useCase = new CreateCompanyProductUseCase(productRepo, userRepo);
  });

  it('crea un producto cuando el nombre no existe para ese cliente', async () => {
    await userRepo.save(makeUser());

    const result = await useCase.execute({
      firebaseUid: 'firebase-uid-1',
      name: 'Monitor',
      categoryId: 'cat-1',
    });

    expect(result.name).toBe('Monitor');
    expect(result.categoryId).toBe('cat-1');
    expect(result.clientId).toBe('user-1');
  });

  it('lanza DuplicateProductNameError si el nombre ya existe para ese cliente', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([makeProduct()]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', name: 'Monitor', categoryId: 'cat-2' }),
    ).rejects.toBeInstanceOf(DuplicateProductNameError);
  });
});

describe('ListCompanyProductsUseCase', () => {
  it('retorna solo los productos del cliente autenticado', async () => {
    const userRepo = new InMemoryUserRepository();
    const productRepo = new InMemoryCompanyProductRepository();
    await userRepo.save(makeUser());
    productRepo.seed([
      makeProduct({ id: 'prod-1', clientId: 'user-1', name: 'Monitor' }),
      makeProduct({ id: 'prod-2', clientId: 'otro-user', name: 'Silla' }),
    ]);

    const useCase = new ListCompanyProductsUseCase(productRepo, userRepo);
    const result = await useCase.execute('firebase-uid-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Monitor');
  });
});

describe('UpdateCompanyProductUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let productRepo: InMemoryCompanyProductRepository;
  let useCase: UpdateCompanyProductUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    productRepo = new InMemoryCompanyProductRepository();
    useCase = new UpdateCompanyProductUseCase(productRepo, userRepo);
  });

  it('actualiza nombre y categoría del producto', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([makeProduct()]);

    const result = await useCase.execute({
      firebaseUid: 'firebase-uid-1',
      productId: 'prod-1',
      name: 'Monitor 4K',
      categoryId: 'cat-2',
    });

    expect(result.name).toBe('Monitor 4K');
    expect(result.categoryId).toBe('cat-2');
  });

  it('lanza ProductNotFoundError si el producto no existe', async () => {
    await userRepo.save(makeUser());

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'no-existe', name: 'X' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('lanza ProductOwnershipError si el producto pertenece a otro cliente', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([makeProduct({ clientId: 'otro-user' })]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'prod-1', name: 'X' }),
    ).rejects.toBeInstanceOf(ProductOwnershipError);
  });

  it('lanza DuplicateProductNameError si el nuevo nombre ya existe', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([
      makeProduct({ id: 'prod-1', name: 'Monitor' }),
      makeProduct({ id: 'prod-2', name: 'Teclado' }),
    ]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'prod-1', name: 'Teclado' }),
    ).rejects.toBeInstanceOf(DuplicateProductNameError);
  });
});

describe('DeleteCompanyProductUseCase', () => {
  let userRepo: InMemoryUserRepository;
  let productRepo: InMemoryCompanyProductRepository;
  let useCase: DeleteCompanyProductUseCase;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    productRepo = new InMemoryCompanyProductRepository();
    useCase = new DeleteCompanyProductUseCase(productRepo, userRepo);
  });

  it('elimina el producto correctamente', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([makeProduct()]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'prod-1' }),
    ).resolves.toBeUndefined();
  });

  it('lanza ProductNotFoundError si el producto no existe', async () => {
    await userRepo.save(makeUser());

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'no-existe' }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('lanza ProductOwnershipError si el producto pertenece a otro cliente', async () => {
    await userRepo.save(makeUser());
    productRepo.seed([makeProduct({ clientId: 'otro-user' })]);

    await expect(
      useCase.execute({ firebaseUid: 'firebase-uid-1', productId: 'prod-1' }),
    ).rejects.toBeInstanceOf(ProductOwnershipError);
  });
});
