import type { Category } from '../entities/category.entity';

export interface RawPricingRule {
  readonly id: string;
  readonly rules: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findByNameEs(nameEs: string): Promise<Category | null>;
  create(category: Category): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(id: string): Promise<void>;
  hasAssociatedGoods(id: string): Promise<boolean>;
  findPricingRules(categoryId: string): Promise<RawPricingRule[]>;
}
