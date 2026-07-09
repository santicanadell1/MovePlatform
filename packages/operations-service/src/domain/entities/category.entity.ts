export interface CategoryProps {
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

export class Category {
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

  private constructor(props: CategoryProps) {
    this.id = props.id;
    this.nameEs = props.nameEs;
    this.nameEn = props.nameEn;
    this.description = props.description;
    this.examples = props.examples;
    this.requiresMonitoring = props.requiresMonitoring;
    this.generatesAlerts = props.generatesAlerts;
    this.surchargePercent = props.surchargePercent;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CategoryProps): Category {
    return new Category(props);
  }

  withNameEs(nameEs: string): Category {
    return Category.create({ ...this, nameEs, updatedAt: new Date() });
  }

  withNameEn(nameEn: string): Category {
    return Category.create({ ...this, nameEn, updatedAt: new Date() });
  }

  withDescription(description: string): Category {
    return Category.create({ ...this, description, updatedAt: new Date() });
  }

  withExamples(examples: unknown[]): Category {
    return Category.create({ ...this, examples, updatedAt: new Date() });
  }

  withRequiresMonitoring(requiresMonitoring: boolean): Category {
    return Category.create({ ...this, requiresMonitoring, updatedAt: new Date() });
  }

  withGeneratesAlerts(generatesAlerts: boolean): Category {
    return Category.create({ ...this, generatesAlerts, updatedAt: new Date() });
  }

  withSurchargePercent(surchargePercent: number): Category {
    return Category.create({ ...this, surchargePercent, updatedAt: new Date() });
  }
}
