import type { CompanyProduct } from '../entities/company-product.entity';

export interface ICompanyProductRepository {
  findById(id: string): Promise<CompanyProduct | null>;
  findByClientId(clientId: string): Promise<CompanyProduct[]>;
  findByClientIdAndName(clientId: string, name: string): Promise<CompanyProduct | null>;
  create(product: CompanyProduct): Promise<CompanyProduct>;
  update(product: CompanyProduct): Promise<CompanyProduct>;
  delete(id: string): Promise<void>;
}
