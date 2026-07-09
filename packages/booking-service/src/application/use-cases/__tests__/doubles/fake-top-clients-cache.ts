import type { CompanyProduct } from '../../../../domain/entities/company-product.entity';
import type { ITopClientsCache } from '../../../../domain/ports/top-clients-cache.port';

export class FakeTopClientsCache implements ITopClientsCache {
  behavior: 'hit' | 'miss' | 'throw' = 'miss';
  products: CompanyProduct[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  async getCachedProducts(_clientId: string): Promise<CompanyProduct[] | null> {
    if (this.behavior === 'throw') throw new Error('Redis connection refused');
    if (this.behavior === 'hit') return [...this.products];
    return null;
  }

  async setTopClients(
    _clientIds: readonly string[],
    _productsMap: ReadonlyMap<string, readonly CompanyProduct[]>,
  ): Promise<void> {}
}
