import { randomUUID } from 'crypto';

import { injectable, inject } from 'inversify';

import { Category } from '../../../domain/entities/category.entity';
import { DuplicateCategoryError } from '../../../domain/errors/category.errors';
import type { ICategoryRepository } from '../../../domain/ports/category.repository.port';
import { TYPES } from '../../../types';

export interface CreateCategoryInput {
  readonly nameEs: string;
  readonly nameEn: string;
  readonly description: string;
  readonly examples: unknown[];
  readonly requiresMonitoring: boolean;
  readonly generatesAlerts: boolean;
  readonly surchargePercent: number;
}

export interface CreateCategoryOutput {
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
export class CreateCategoryUseCase {
  constructor(
    @inject(TYPES.CategoryRepository)
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CreateCategoryOutput> {
    const existing = await this.categoryRepo.findByNameEs(input.nameEs);
    if (existing) throw new DuplicateCategoryError(input.nameEs);

    const now = new Date();
    const category = Category.create({
      id: randomUUID(),
      nameEs: input.nameEs,
      nameEn: input.nameEn,
      description: input.description,
      examples: input.examples,
      requiresMonitoring: input.requiresMonitoring,
      generatesAlerts: input.generatesAlerts,
      surchargePercent: input.surchargePercent,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.categoryRepo.create(category);
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
