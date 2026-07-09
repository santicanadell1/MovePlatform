import type { CostBreakdown } from '../../domain/entities/reservation.entity';
import type { Good } from '../../domain/entities/good.entity';
import type {
  IPricingRuleRepository,
  PricingRuleData,
} from '../../domain/ports/pricing-rule.repository.port';

export interface PricingDefaults {
  baseRate: number;
  ratePerKm: number;
  surchargePercent: number;
}

const FALLBACK_DEFAULTS: PricingDefaults = {
  baseRate: 100,
  ratePerKm: 50,
  surchargePercent: 0,
};

export class PricingService {
  private rulesMap: Map<string, PricingRuleData> = new Map();
  private readonly defaults: PricingDefaults;

  constructor(
    private readonly repo: IPricingRuleRepository,
    defaults?: Partial<PricingDefaults>,
  ) {
    this.defaults = { ...FALLBACK_DEFAULTS, ...defaults };
  }

  async loadAtBoot(): Promise<void> {
    const rules = await this.repo.findAllActive();
    this.rulesMap = new Map(rules.map((r) => [r.categoryId, r]));
  }

  async reload(): Promise<void> {
    await this.loadAtBoot();
  }

  quote(goods: Good[], distanceKm: number): { totalCost: number; costBreakdown: CostBreakdown } {
    const goodsBreakdown = goods.map((good) => {
      const rule = good.categoryId ? this.rulesMap.get(good.categoryId) : undefined;
      const baseRate = rule?.rules.baseRate ?? this.defaults.baseRate;
      const ratePerKm = rule?.rules.ratePerKm ?? this.defaults.ratePerKm;
      const surchargePercent = rule?.rules.surchargePercent ?? this.defaults.surchargePercent;

      const base = (baseRate + distanceKm * ratePerKm) * good.quantity;
      const goodCost = Math.round(base * (1 + surchargePercent / 100) * 100) / 100;

      return {
        categoryId: good.categoryId ?? 'unknown',
        quantity: good.quantity,
        baseRate,
        ratePerKm,
        distanceKm,
        surchargePercent,
        goodCost,
      };
    });

    const totalCost =
      Math.round(goodsBreakdown.reduce((sum, g) => sum + g.goodCost, 0) * 100) / 100;

    return {
      totalCost,
      costBreakdown: { goods: goodsBreakdown, totalCost },
    };
  }
}
