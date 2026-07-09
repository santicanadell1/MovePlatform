import { inject, injectable } from 'inversify';
import { AlertType } from '@move/shared';

import { IAlertRepository } from '../../application/ports/alert.repository';
import { Alert } from '../../domain/entities/alert.entity';
import { PrismaClient } from '../../generated/client';
import { TYPES } from '../../types';

@injectable()
export class PrismaAlertRepository implements IAlertRepository {
  constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}

  async save(alert: Alert): Promise<Alert | null> {
    try {
      const row = await this.prisma.alert.create({
        data: {
          id: alert.id,
          transferId: alert.transferId,
          type: alert.type,
          lat: alert.lat,
          lng: alert.lng,
          message: alert.message,
          createdAt: alert.createdAt,
        },
      });

      return new Alert({
        id: row.id,
        transferId: row.transferId,
        type: row.type as AlertType,
        lat: row.lat,
        lng: row.lng,
        message: row.message,
        createdAt: row.createdAt,
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        return null;
      }
      throw err;
    }
  }
}

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}
