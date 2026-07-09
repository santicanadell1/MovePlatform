import { injectable, inject } from 'inversify';

import { CategoryNotFoundError, CategoryInUseError } from '../../../domain/errors/category.errors';
import type { ICategoryRepository } from '../../../domain/ports/category.repository.port';
import { TYPES } from '../../../types';

export interface DeleteCategoryInput {
  readonly categoryId: string;
}

@injectable()
export class DeleteCategoryUseCase {
  constructor(
    @inject(TYPES.CategoryRepository)
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(input: DeleteCategoryInput): Promise<void> {
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category) throw new CategoryNotFoundError(input.categoryId);

    const inUse = await this.categoryRepo.hasAssociatedGoods(input.categoryId);
    if (inUse) throw new CategoryInUseError();

    await this.categoryRepo.delete(input.categoryId);
  }
}
