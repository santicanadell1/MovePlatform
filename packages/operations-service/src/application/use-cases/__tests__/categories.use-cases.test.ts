import { Category } from '../../../domain/entities/category.entity';
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
} from '../../../domain/errors/category.errors';
import { CreateCategoryUseCase } from '../categories/create-category.use-case';
import { DeleteCategoryUseCase } from '../categories/delete-category.use-case';
import { GetCategoriesUseCase } from '../categories/get-categories.use-case';
import { UpdateCategoryUseCase } from '../categories/update-category.use-case';

import { InMemoryCategoryRepository } from './doubles/in-memory-category.repository';

const makeCategory = (overrides: Partial<Category> = {}): Category =>
  Category.create({
    id: 'cat-1',
    nameEs: 'Frágil',
    nameEn: 'Fragile',
    description: 'Objetos frágiles',
    examples: ['cristal', 'cerámica'],
    requiresMonitoring: false,
    generatesAlerts: false,
    surchargePercent: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ---------------------------------------------------------------------------
// GetCategoriesUseCase
// ---------------------------------------------------------------------------

describe('GetCategoriesUseCase', () => {
  it('retorna lista vacía cuando no hay categorías', async () => {
    const repo = new InMemoryCategoryRepository();
    const useCase = new GetCategoriesUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(0);
  });

  it('retorna todas las categorías con pricingRules vacías', async () => {
    const repo = new InMemoryCategoryRepository();
    repo.seed([makeCategory(), makeCategory({ id: 'cat-2', nameEs: 'Pesado', nameEn: 'Heavy' })]);
    const useCase = new GetCategoriesUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0].nameEs).toBe('Frágil');
    expect(result[0].pricingRules).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CreateCategoryUseCase
// ---------------------------------------------------------------------------

describe('CreateCategoryUseCase', () => {
  let repo: InMemoryCategoryRepository;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    useCase = new CreateCategoryUseCase(repo);
  });

  it('crea una categoría con los valores por defecto', async () => {
    const result = await useCase.execute({
      nameEs: 'Frágil',
      nameEn: 'Fragile',
      description: 'Objetos frágiles',
      examples: [],
      requiresMonitoring: false,
      generatesAlerts: false,
      surchargePercent: 0,
    });

    expect(result.nameEs).toBe('Frágil');
    expect(result.nameEn).toBe('Fragile');
    expect(result.requiresMonitoring).toBe(false);
    expect(result.surchargePercent).toBe(0);
    expect(result.id).toBeDefined();
  });

  it('crea una categoría con flags y recargo', async () => {
    const result = await useCase.execute({
      nameEs: 'Peligroso',
      nameEn: 'Dangerous',
      description: 'Materiales peligrosos',
      examples: [],
      requiresMonitoring: true,
      generatesAlerts: true,
      surchargePercent: 25,
    });

    expect(result.requiresMonitoring).toBe(true);
    expect(result.generatesAlerts).toBe(true);
    expect(result.surchargePercent).toBe(25);
  });

  it('lanza DuplicateCategoryError si ya existe una categoría con el mismo nameEs', async () => {
    repo.seed([makeCategory()]);

    await expect(
      useCase.execute({
        nameEs: 'Frágil',
        nameEn: 'Otro',
        description: 'Descripción',
        examples: [],
        requiresMonitoring: false,
        generatesAlerts: false,
        surchargePercent: 0,
      }),
    ).rejects.toBeInstanceOf(DuplicateCategoryError);
  });
});

// ---------------------------------------------------------------------------
// UpdateCategoryUseCase
// ---------------------------------------------------------------------------

describe('UpdateCategoryUseCase', () => {
  let repo: InMemoryCategoryRepository;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    useCase = new UpdateCategoryUseCase(repo);
  });

  it('actualiza requiresMonitoring y surchargePercent', async () => {
    repo.seed([makeCategory()]);

    const result = await useCase.execute({
      categoryId: 'cat-1',
      requiresMonitoring: true,
      surchargePercent: 15,
    });

    expect(result.requiresMonitoring).toBe(true);
    expect(result.surchargePercent).toBe(15);
  });

  it('actualiza generatesAlerts', async () => {
    repo.seed([makeCategory()]);

    const result = await useCase.execute({ categoryId: 'cat-1', generatesAlerts: true });

    expect(result.generatesAlerts).toBe(true);
  });

  it('actualiza nameEs sin conflicto', async () => {
    repo.seed([makeCategory()]);

    const result = await useCase.execute({ categoryId: 'cat-1', nameEs: 'Nuevo nombre' });

    expect(result.nameEs).toBe('Nuevo nombre');
  });

  it('lanza CategoryNotFoundError si la categoría no existe', async () => {
    await expect(
      useCase.execute({ categoryId: 'no-existe', requiresMonitoring: true }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('lanza DuplicateCategoryError si el nuevo nameEs ya lo usa otra categoría', async () => {
    repo.seed([
      makeCategory({ id: 'cat-1', nameEs: 'Frágil' }),
      makeCategory({ id: 'cat-2', nameEs: 'Pesado', nameEn: 'Heavy' }),
    ]);

    await expect(useCase.execute({ categoryId: 'cat-1', nameEs: 'Pesado' })).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });
});

// ---------------------------------------------------------------------------
// DeleteCategoryUseCase
// ---------------------------------------------------------------------------

describe('DeleteCategoryUseCase', () => {
  let repo: InMemoryCategoryRepository;
  let useCase: DeleteCategoryUseCase;

  beforeEach(() => {
    repo = new InMemoryCategoryRepository();
    useCase = new DeleteCategoryUseCase(repo);
  });

  it('elimina la categoría correctamente', async () => {
    repo.seed([makeCategory()]);

    await expect(useCase.execute({ categoryId: 'cat-1' })).resolves.toBeUndefined();
  });

  it('lanza CategoryNotFoundError si la categoría no existe', async () => {
    await expect(useCase.execute({ categoryId: 'no-existe' })).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it('lanza CategoryInUseError si la categoría tiene reservas asociadas', async () => {
    repo.seed([makeCategory()]);
    repo.seedGoods('cat-1', 3);

    await expect(useCase.execute({ categoryId: 'cat-1' })).rejects.toBeInstanceOf(
      CategoryInUseError,
    );
  });
});
