import { injectable, inject } from 'inversify';
import { Decimal } from '@prisma/client/runtime/library';

import { Category } from '../../domain/entities/category.entity';
import type {
  ICategoryRepository,
  RawPricingRule,
} from '../../domain/ports/category.repository.port';
import { PrismaClient } from '../../generated/client';

@injectable()
export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.toEntity(r));
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByNameEs(nameEs: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { nameEs } });
    return row ? this.toEntity(row) : null;
  }

  async create(category: Category): Promise<Category> {
    const row = await this.prisma.category.create({
      data: {
        id: category.id,
        nameEs: category.nameEs,
        nameEn: category.nameEn,
        description: category.description,
        examples: category.examples as object[],
        requiresMonitoring: category.requiresMonitoring,
        generatesAlerts: category.generatesAlerts,
        surchargePercent: new Decimal(category.surchargePercent),
      },
    });
    return this.toEntity(row);
  }

  async update(category: Category): Promise<Category> {
    const row = await this.prisma.category.update({
      where: { id: category.id },
      data: {
        nameEs: category.nameEs,
        nameEn: category.nameEn,
        description: category.description,
        examples: category.examples as object[],
        requiresMonitoring: category.requiresMonitoring,
        generatesAlerts: category.generatesAlerts,
        surchargePercent: new Decimal(category.surchargePercent),
        updatedAt: category.updatedAt,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  async hasAssociatedGoods(id: string): Promise<boolean> {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM booking.goods WHERE category_id = ${id}
    `;
    return (result[0]?.count ?? 0n) > 0n;
  }

  async findPricingRules(categoryId: string): Promise<RawPricingRule[]> {
    const rows = await this.prisma.pricingRule.findMany({ where: { categoryId } });
    return rows.map((r) => ({
      id: r.id,
      rules: r.rules,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  private toEntity(row: {
    id: string;
    nameEs: string;
    nameEn: string;
    description: string;
    examples: unknown;
    requiresMonitoring: boolean;
    generatesAlerts: boolean;
    surchargePercent: Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): Category {
    return Category.create({
      id: row.id,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      description: row.description,
      examples: Array.isArray(row.examples) ? row.examples : [],
      requiresMonitoring: row.requiresMonitoring,
      generatesAlerts: row.generatesAlerts,
      surchargePercent: row.surchargePercent.toNumber(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
