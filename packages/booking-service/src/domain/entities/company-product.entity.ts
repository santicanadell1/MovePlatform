export interface CompanyProductProps {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly categoryId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CompanyProduct {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly categoryId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: CompanyProductProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.name = props.name;
    this.categoryId = props.categoryId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CompanyProductProps): CompanyProduct {
    return new CompanyProduct(props);
  }

  withName(name: string): CompanyProduct {
    return CompanyProduct.create({ ...this, name });
  }

  withCategoryId(categoryId: string): CompanyProduct {
    return CompanyProduct.create({ ...this, categoryId });
  }
}
