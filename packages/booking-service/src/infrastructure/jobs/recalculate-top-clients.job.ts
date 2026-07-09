import type { CompanyProduct } from '../../domain/entities/company-product.entity';
import type { ICompanyProductRepository } from '../../domain/ports/company-product.repository.port';
import type { ITopClientsCache } from '../../domain/ports/top-clients-cache.port';
import { PrismaClient } from '../../generated/client';

export class RecalculateTopClientsJob {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly productRepo: ICompanyProductRepository,
    private readonly cache: ITopClientsCache,
  ) {}

  async execute(): Promise<void> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const groups = await this.prisma.reservation.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const topClientIds = groups.map((g) => g.clientId);
    const productsMap = new Map<string, readonly CompanyProduct[]>();

    for (const clientId of topClientIds) {
      const products = await this.productRepo.findByClientId(clientId);
      productsMap.set(clientId, products);
    }

    await this.cache.setTopClients(topClientIds, productsMap);
  }
}
