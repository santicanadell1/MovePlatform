import { injectable, inject } from 'inversify';

import { CompanyProduct } from '../../domain/entities/company-product.entity';
import type { ICompanyProductRepository } from '../../domain/ports/company-product.repository.port';
import { PrismaClient } from '../../generated/client';

@injectable()
export class PrismaCompanyProductRepository implements ICompanyProductRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<CompanyProduct | null> {
    const row = await this.prisma.companyProduct.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByClientId(clientId: string): Promise<CompanyProduct[]> {
    const rows = await this.prisma.companyProduct.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByClientIdAndName(clientId: string, name: string): Promise<CompanyProduct | null> {
    const row = await this.prisma.companyProduct.findUnique({
      where: { clientId_name: { clientId, name } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(product: CompanyProduct): Promise<CompanyProduct> {
    const row = await this.prisma.companyProduct.create({
      data: {
        id: product.id,
        clientId: product.clientId,
        name: product.name,
        categoryId: product.categoryId,
      },
    });
    return this.toEntity(row);
  }

  async update(product: CompanyProduct): Promise<CompanyProduct> {
    const row = await this.prisma.companyProduct.update({
      where: { id: product.id },
      data: {
        name: product.name,
        categoryId: product.categoryId,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyProduct.delete({ where: { id } });
  }

  private toEntity(row: {
    id: string;
    clientId: string;
    name: string;
    categoryId: string;
    createdAt: Date;
    updatedAt: Date;
  }): CompanyProduct {
    return CompanyProduct.create({
      id: row.id,
      clientId: row.clientId,
      name: row.name,
      categoryId: row.categoryId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
