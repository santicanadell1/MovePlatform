import type { CompanyProduct } from '../entities/company-product.entity';

export interface ITopClientsCache {
  getCachedProducts(clientId: string): Promise<CompanyProduct[] | null>;
  setTopClients(
    clientIds: readonly string[],
    productsMap: ReadonlyMap<string, readonly CompanyProduct[]>,
  ): Promise<void>;
}
