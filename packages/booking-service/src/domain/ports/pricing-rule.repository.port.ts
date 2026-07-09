export interface PricingRuleData {
  readonly id: string;
  readonly categoryId: string;
  readonly rules: {
    readonly baseRate: number;
    readonly ratePerKm: number;
    readonly surchargePercent: number;
  };
  readonly active: boolean;
}

export interface IPricingRuleRepository {
  findAllActive(): Promise<PricingRuleData[]>;
}
