import { injectable, inject } from 'inversify';
import type Redis from 'ioredis';

import { CompanyProduct } from '../../domain/entities/company-product.entity';
import type { ITopClientsCache } from '../../domain/ports/top-clients-cache.port';

const TOP_CLIENTS_KEY = 'top20:clients';
const PRODUCTS_KEY = (clientId: string) => `products:${clientId}`;
const TTL_SECONDS = 604800; // 7 días

@injectable()
export class RedisTopClientsCache implements ITopClientsCache {
  constructor(@inject('RedisClient') private readonly redis: Redis) {}

  async getCachedProducts(clientId: string): Promise<CompanyProduct[] | null> {
    const isMember = await this.redis.sismember(TOP_CLIENTS_KEY, clientId);
    if (isMember === 0) return null;

    const raw = await this.redis.get(PRODUCTS_KEY(clientId));
    if (raw === null) return null;

    const items = JSON.parse(raw) as Array<{
      id: string;
      clientId: string;
      name: string;
      categoryId: string;
      createdAt: string;
      updatedAt: string;
    }>;

    return items.map((item) =>
      CompanyProduct.create({
        id: item.id,
        clientId: item.clientId,
        name: item.name,
        categoryId: item.categoryId,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }),
    );
  }

  async setTopClients(
    clientIds: readonly string[],
    productsMap: ReadonlyMap<string, readonly CompanyProduct[]>,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(TOP_CLIENTS_KEY);
    if (clientIds.length > 0) {
      pipeline.sadd(TOP_CLIENTS_KEY, ...clientIds);
      pipeline.expire(TOP_CLIENTS_KEY, TTL_SECONDS);
    }
    for (const [clientId, products] of productsMap) {
      pipeline.set(PRODUCTS_KEY(clientId), JSON.stringify(products), 'EX', TTL_SECONDS);
    }
    await pipeline.exec();
  }
}
