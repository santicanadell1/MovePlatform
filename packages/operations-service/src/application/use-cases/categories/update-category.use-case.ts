import { injectable, inject } from 'inversify';

import {
  CategoryNotFoundError,
  DuplicateCategoryError,
} from '../../../domain/errors/category.errors';
import type { ICategoryRepository } from '../../../domain/ports/category.repository.port';
import { TYPES } from '../../../types';

export interface UpdateCategoryInput {
  readonly categoryId: string;
  readonly nameEs?: string;
  readonly nameEn?: string;
  readonly description?: string;
  readonly examples?: unknown[];
  readonly requiresMonitoring?: boolean;
  readonly generatesAlerts?: boolean;
  readonly surchargePercent?: number;
}

export interface UpdateCategoryOutput {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly description: string;
  readonly examples: unknown[];
  readonly requiresMonitoring: boolean;
  readonly generatesAlerts: boolean;
  readonly surchargePercent: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class UpdateCategoryUseCase {
  constructor(
    @inject(TYPES.CategoryRepository)
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(input: UpdateCategoryInput): Promise<UpdateCategoryOutput> {
    let category = await this.categoryRepo.findById(input.categoryId);
    if (!category) throw new CategoryNotFoundError(input.categoryId);

    if (input.nameEs !== undefined && input.nameEs !== category.nameEs) {
      const duplicate = await this.categoryRepo.findByNameEs(input.nameEs);
      if (duplicate) throw new DuplicateCategoryError(input.nameEs);
      category = category.withNameEs(input.nameEs);
    }
    if (input.nameEn !== undefined) category = category.withNameEn(input.nameEn);
    if (input.description !== undefined) category = category.withDescription(input.description);
    if (input.examples !== undefined) category = category.withExamples(input.examples);
    if (input.requiresMonitoring !== undefined)
      category = category.withRequiresMonitoring(input.requiresMonitoring);
    if (input.generatesAlerts !== undefined)
      category = category.withGeneratesAlerts(input.generatesAlerts);
    if (input.surchargePercent !== undefined)
      category = category.withSurchargePercent(input.surchargePercent);

    const saved = await this.categoryRepo.update(category);
    return {
      id: saved.id,
      nameEs: saved.nameEs,
      nameEn: saved.nameEn,
      description: saved.description,
      examples: saved.examples,
      requiresMonitoring: saved.requiresMonitoring,
      generatesAlerts: saved.generatesAlerts,
      surchargePercent: saved.surchargePercent,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
