import { inject, injectable } from 'inversify';

import { IIncidentRepository } from '../../application/ports/incident.repository';
import { Incident } from '../../domain/entities/incident.entity';
import { PrismaClient } from '../../generated/client';
import { TYPES } from '../../types';

@injectable()
export class PrismaIncidentRepository implements IIncidentRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async save(incident: Incident): Promise<Incident> {
    const row = await this.prisma.incident.create({
      data: {
        id: incident.id,
        transferId: incident.transferId,
        conductorId: incident.conductorId,
        description: incident.description,
        createdAt: incident.createdAt,
      },
    });

    return new Incident({
      id: row.id,
      transferId: row.transferId,
      conductorId: row.conductorId,
      description: row.description,
      createdAt: row.createdAt,
    });
  }

  async findByTransferId(transferId: string): Promise<Incident[]> {
    const rows = await this.prisma.incident.findMany({
      where: { transferId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(
      (row) =>
        new Incident({
          id: row.id,
          transferId: row.transferId,
          conductorId: row.conductorId,
          description: row.description,
          createdAt: row.createdAt,
        }),
    );
  }
}
