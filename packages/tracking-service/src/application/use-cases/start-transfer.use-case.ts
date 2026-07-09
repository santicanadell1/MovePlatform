import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  TransferStatus,
  type TransferStartedEvent,
} from '@move/shared';
import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';

import { Transfer } from '../../domain/entities/transfer.entity';
import {
  ConductorMismatchError,
  TransferNotPendingError,
  VehicleAlreadyInTransitError,
  VehicleNotRegisteredError,
} from '../../domain/errors/transfer.errors';
import { TYPES } from '../../types';
import { ICacheService } from '../ports/cache.service';
import type { IEventPublisher } from '../ports/event-publisher';
import { ITransferRepository } from '../ports/transfer.repository';
import type { IVehicleRegistryRepository } from '../ports/vehicle-registry.repository';

export interface StartTransferInput {
  readonly reservationId: string;
  readonly conductorId: string;
  readonly vehicleId: string;
  readonly deviceId: string;
}

export interface StartTransferOutput {
  readonly transferId: string;
  readonly reservationId: string;
  readonly status: string;
  readonly startedAt: Date;
}

@injectable()
export class StartTransferUseCase {
  constructor(
    @inject(TYPES.TransferRepository) private readonly transferRepository: ITransferRepository,
    @inject(TYPES.CacheService) private readonly cacheService: ICacheService,
    @inject(TYPES.VehicleRegistryRepository)
    private readonly vehicleRegistry: IVehicleRegistryRepository,
    @inject(TYPES.EventPublisher) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: StartTransferInput): Promise<StartTransferOutput> {
    const vehicle = await this.vehicleRegistry.findVehicleById(input.vehicleId);
    if (!vehicle) {
      throw new VehicleNotRegisteredError(input.vehicleId);
    }

    const activeForVehicle = await this.transferRepository.findActiveByVehicleId(input.vehicleId);
    if (activeForVehicle) {
      throw new VehicleAlreadyInTransitError(input.vehicleId);
    }

    const existing = await this.transferRepository.findByReservationId(input.reservationId);

    if (existing) {
      if (!existing.belongsToConductor(input.conductorId)) {
        throw new ConductorMismatchError();
      }
      if (!existing.isPending()) {
        throw new TransferNotPendingError(input.reservationId);
      }
      const started = existing.start();
      const saved = await this.transferRepository.update(started);
      await this.cacheService.set(`transfer:active:${input.deviceId}`, saved.id);
      await this.publishStarted(saved);
      return {
        transferId: saved.id,
        reservationId: saved.reservationId,
        status: saved.status,
        startedAt: saved.startedAt!,
      };
    }

    const transfer = new Transfer({
      id: uuidv4(),
      reservationId: input.reservationId,
      vehicleId: input.vehicleId,
      conductorId: input.conductorId,
      status: TransferStatus.PENDING,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
    });

    if (!transfer.belongsToConductor(input.conductorId)) {
      throw new ConductorMismatchError();
    }

    const started = transfer.start();
    const saved = await this.transferRepository.save(started);
    await this.cacheService.set(`transfer:active:${input.deviceId}`, saved.id);
    await this.publishStarted(saved);

    return {
      transferId: saved.id,
      reservationId: saved.reservationId,
      status: saved.status,
      startedAt: saved.startedAt!,
    };
  }

  private async publishStarted(saved: Transfer): Promise<void> {
    const event: TransferStartedEvent = {
      eventId: uuidv4(),
      occurredAt: saved.startedAt!.toISOString(),
      transferId: saved.id,
      reservationId: saved.reservationId,
      vehicleId: saved.vehicleId,
      conductorId: saved.conductorId,
      startedAt: saved.startedAt!.toISOString(),
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.TRANSFER_STARTED,
        event,
      );
    } catch {
      // Traslado ya iniciado; la proyección en operations es eventual consistency aceptada.
    }
  }
}
