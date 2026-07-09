import { injectable, inject } from 'inversify';

import type {
  ICategoryRepository,
  RawPricingRule,
} from '../../../domain/ports/category.repository.port';
import { TYPES } from '../../../types';

export interface CategoryOutput {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly description: string;
  readonly examples: unknown[];
  readonly requiresMonitoring: boolean;
  readonly generatesAlerts: boolean;
  readonly surchargePercent: number;
  readonly pricingRules: RawPricingRule[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class GetCategoriesUseCase {
  constructor(
    @inject(TYPES.CategoryRepository)
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  async execute(): Promise<CategoryOutput[]> {
    const categories = await this.categoryRepo.findAll();
    const results = await Promise.all(
      categories.map(async (cat) => {
        const pricingRules = await this.categoryRepo.findPricingRules(cat.id);
        return {
          id: cat.id,
          nameEs: cat.nameEs,
          nameEn: cat.nameEn,
          description: cat.description,
          examples: cat.examples,
          requiresMonitoring: cat.requiresMonitoring,
          generatesAlerts: cat.generatesAlerts,
          surchargePercent: cat.surchargePercent,
          pricingRules,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        };
      }),
    );
    return results;
  }
}
