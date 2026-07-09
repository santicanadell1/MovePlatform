import type {
  IPricingRuleRepository,
  PricingRuleData,
} from '../../../../domain/ports/pricing-rule.repository.port';

export class InMemoryPricingRuleRepository implements IPricingRuleRepository {
  private rules: PricingRuleData[] = [];

  seed(rules: PricingRuleData[]): void {
    this.rules = [...rules];
  }

  findAllActive(): Promise<PricingRuleData[]> {
    return Promise.resolve(this.rules.filter((r) => r.active));
  }
}
