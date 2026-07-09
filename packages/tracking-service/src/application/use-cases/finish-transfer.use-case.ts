import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  type TransferCompletedEvent,
} from '@move/shared';
import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';

import {
  ConductorMismatchError,
  TransferNotFoundError,
  TransferNotInTransitError,
} from '../../domain/errors/transfer.errors';
import { TYPES } from '../../types';
import { ICacheService } from '../ports/cache.service';
import type { IEventPublisher } from '../ports/event-publisher';
import { ITransferRepository } from '../ports/transfer.repository';

export interface FinishTransferInput {
  readonly reservationId: string;
  readonly conductorId: string;
  readonly deviceId: string;
}

export interface FinishTransferOutput {
  readonly transferId: string;
  readonly reservationId: string;
  readonly status: string;
  readonly finishedAt: Date;
}

@injectable()
export class FinishTransferUseCase {
  constructor(
    @inject(TYPES.TransferRepository) private readonly transferRepository: ITransferRepository,
    @inject(TYPES.CacheService) private readonly cacheService: ICacheService,
    @inject(TYPES.EventPublisher) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: FinishTransferInput): Promise<FinishTransferOutput> {
    const transfer = await this.transferRepository.findByReservationId(input.reservationId);

    if (!transfer) {
      throw new TransferNotFoundError(input.reservationId);
    }

    if (!transfer.belongsToConductor(input.conductorId)) {
      throw new ConductorMismatchError();
    }

    if (!transfer.isInTransit()) {
      throw new TransferNotInTransitError(input.reservationId);
    }

    const finished = transfer.finish();
    const saved = await this.transferRepository.update(finished);
    await this.cacheService.delete(`transfer:active:${input.deviceId}`);

    const event: TransferCompletedEvent = {
      eventId: uuidv4(),
      occurredAt: saved.finishedAt!.toISOString(),
      transferId: saved.id,
      reservationId: saved.reservationId,
      finishedAt: saved.finishedAt!.toISOString(),
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.TRANSFER_COMPLETED,
        event,
      );
    } catch {
      // Traslado ya finalizado; la proyección en operations es eventual consistency aceptada.
    }

    return {
      transferId: saved.id,
      reservationId: saved.reservationId,
      status: saved.status,
      finishedAt: saved.finishedAt!,
    };
  }
}
