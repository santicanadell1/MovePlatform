import { TransferStatus } from '@move/shared';
import { inject, injectable } from 'inversify';

import { PrismaClient } from '../../generated/client';
import { Transfer } from '../../domain/entities/transfer.entity';
import { ITransferRepository } from '../../application/ports/transfer.repository';
import { TYPES } from '../../types';

@injectable()
export class PrismaTransferRepository implements ITransferRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async findActiveByVehicleId(vehicleId: string): Promise<Transfer | null> {
    const row = await this.prisma.transfer.findFirst({
      where: { vehicleId, status: 'IN_TRANSIT' },
    });

    if (!row) return null;
    return this.toDomain(row);
  }

  async findByReservationId(reservationId: string): Promise<Transfer | null> {
    const row = await this.prisma.transfer.findUnique({
      where: { reservationId },
    });

    if (!row) return null;
    return this.toDomain(row);
  }

  async save(transfer: Transfer): Promise<Transfer> {
    const row = await this.prisma.transfer.create({
      data: {
        id: transfer.id,
        reservationId: transfer.reservationId,
        vehicleId: transfer.vehicleId,
        conductorId: transfer.conductorId,
        status: transfer.status,
        startedAt: transfer.startedAt,
        finishedAt: transfer.finishedAt,
      },
    });

    return this.toDomain(row);
  }

  async update(transfer: Transfer): Promise<Transfer> {
    const row = await this.prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        status: transfer.status,
        startedAt: transfer.startedAt,
        finishedAt: transfer.finishedAt,
      },
    });

    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    reservationId: string;
    vehicleId: string;
    conductorId: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
  }): Transfer {
    return new Transfer({
      id: row.id,
      reservationId: row.reservationId,
      vehicleId: row.vehicleId,
      conductorId: row.conductorId,
      status: row.status as TransferStatus,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
    });
  }
}
