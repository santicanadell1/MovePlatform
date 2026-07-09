import { injectable, inject } from 'inversify';

import { CompanyLocation } from '../../domain/entities/company-location.entity';
import type { ICompanyLocationRepository } from '../../domain/ports/company-location.repository.port';
import { PrismaClient } from '../../generated/client';

@injectable()
export class PrismaCompanyLocationRepository implements ICompanyLocationRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<CompanyLocation | null> {
    const row = await this.prisma.companyLocation.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByClientId(clientId: string): Promise<CompanyLocation[]> {
    const rows = await this.prisma.companyLocation.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByClientIdAndName(clientId: string, name: string): Promise<CompanyLocation | null> {
    const row = await this.prisma.companyLocation.findUnique({
      where: { clientId_name: { clientId, name } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(location: CompanyLocation): Promise<CompanyLocation> {
    const row = await this.prisma.companyLocation.create({
      data: {
        id: location.id,
        clientId: location.clientId,
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      },
    });
    return this.toEntity(row);
  }

  async update(location: CompanyLocation): Promise<CompanyLocation> {
    const row = await this.prisma.companyLocation.update({
      where: { id: location.id },
      data: {
        name: location.name,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyLocation.delete({ where: { id } });
  }

  private toEntity(row: {
    id: string;
    clientId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    createdAt: Date;
    updatedAt: Date;
  }): CompanyLocation {
    return CompanyLocation.create({
      id: row.id,
      clientId: row.clientId,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
