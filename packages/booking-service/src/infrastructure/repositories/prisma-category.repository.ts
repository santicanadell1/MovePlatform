import type { PrismaClient } from '../../generated/client';
import type { ICategoryRepository } from '../../domain/ports/category.repository.port';

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllForAi(): Promise<Array<{ id: string; name: string; examples: string[] }>> {
    const rows = await this.prisma.category.findMany({
      select: { id: true, nameEs: true, examples: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.nameEs,
      examples: Array.isArray(r.examples) ? (r.examples as string[]) : [],
    }));
  }

  async findById(id: string): Promise<{ id: string; name: string } | null> {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, nameEs: true },
    });
    return row ? { id: row.id, name: row.nameEs } : null;
  }
}
