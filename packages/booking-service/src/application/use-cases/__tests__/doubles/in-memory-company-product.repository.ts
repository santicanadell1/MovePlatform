import type { CompanyProduct } from '../../../../domain/entities/company-product.entity';
import type { ICompanyProductRepository } from '../../../../domain/ports/company-product.repository.port';

export class InMemoryCompanyProductRepository implements ICompanyProductRepository {
  private products: CompanyProduct[] = [];

  seed(products: CompanyProduct[]): void {
    this.products = [...products];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<CompanyProduct | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByClientId(clientId: string): Promise<CompanyProduct[]> {
    return this.products.filter((p) => p.clientId === clientId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByClientIdAndName(clientId: string, name: string): Promise<CompanyProduct | null> {
    return this.products.find((p) => p.clientId === clientId && p.name === name) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(product: CompanyProduct): Promise<CompanyProduct> {
    this.products.push(product);
    return product;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(product: CompanyProduct): Promise<CompanyProduct> {
    const idx = this.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) this.products[idx] = product;
    return product;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(id: string): Promise<void> {
    this.products = this.products.filter((p) => p.id !== id);
  }
}
