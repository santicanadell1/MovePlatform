import { injectable, inject } from 'inversify';

import type {
  IPricingRuleRepository,
  PricingRuleData,
} from '../../domain/ports/pricing-rule.repository.port';
import { PrismaClient } from '../../generated/client';

@injectable()
export class PrismaPricingRuleRepository implements IPricingRuleRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findAllActive(): Promise<PricingRuleData[]> {
    const rows = await this.prisma.pricingRule.findMany({ where: { active: true } });
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      rules: row.rules as PricingRuleData['rules'],
      active: row.active,
    }));
  }
}
