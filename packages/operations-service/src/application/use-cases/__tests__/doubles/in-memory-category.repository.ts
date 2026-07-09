import type { Category } from '../../../../domain/entities/category.entity';
import type {
  ICategoryRepository,
  RawPricingRule,
} from '../../../../domain/ports/category.repository.port';

export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories: Category[] = [];
  private goodsMap: Map<string, number> = new Map();

  seed(categories: Category[]): void {
    this.categories = [...categories];
  }

  seedGoods(categoryId: string, count: number): void {
    this.goodsMap.set(categoryId, count);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(): Promise<Category[]> {
    return [...this.categories];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<Category | null> {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByNameEs(nameEs: string): Promise<Category | null> {
    return this.categories.find((c) => c.nameEs === nameEs) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(category: Category): Promise<Category> {
    this.categories.push(category);
    return category;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(category: Category): Promise<Category> {
    const idx = this.categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) this.categories[idx] = category;
    return category;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(id: string): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async hasAssociatedGoods(id: string): Promise<boolean> {
    return (this.goodsMap.get(id) ?? 0) > 0;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findPricingRules(_categoryId: string): Promise<RawPricingRule[]> {
    return [];
  }
}
