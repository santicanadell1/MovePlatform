import { randomUUID } from 'crypto';

import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  type VehicleRegisteredEvent,
} from '@move/shared';
import { injectable, inject } from 'inversify';

import { Vehicle } from '../../../domain/entities/vehicle.entity';
import {
  DuplicateGpsDeviceIdError,
  DuplicatePlateError,
} from '../../../domain/errors/vehicle.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import type { IVehicleRepository } from '../../../domain/ports/vehicle.repository.port';
import { TYPES } from '../../../types';

export interface CreateVehicleInput {
  readonly plate: string;
  readonly type: string;
  readonly capacity: number;
  readonly gpsDeviceId?: string;
}

export interface CreateVehicleOutput {
  readonly id: string;
  readonly plate: string;
  readonly type: string;
  readonly capacity: number;
  readonly gpsDeviceId: string | null;
  readonly available: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class CreateVehicleUseCase {
  constructor(
    @inject(TYPES.VehicleRepository)
    private readonly vehicleRepo: IVehicleRepository,
    @inject(TYPES.EventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: CreateVehicleInput): Promise<CreateVehicleOutput> {
    const existingPlate = await this.vehicleRepo.findByPlate(input.plate);
    if (existingPlate) throw new DuplicatePlateError(input.plate);

    if (input.gpsDeviceId !== undefined) {
      const existingGps = await this.vehicleRepo.findByGpsDeviceId(input.gpsDeviceId);
      if (existingGps) throw new DuplicateGpsDeviceIdError(input.gpsDeviceId);
    }

    const now = new Date();
    const vehicle = Vehicle.create({
      id: randomUUID(),
      plate: input.plate,
      type: input.type,
      capacity: input.capacity,
      gpsDeviceId: input.gpsDeviceId ?? null,
      available: true,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.vehicleRepo.create(vehicle);

    const event: VehicleRegisteredEvent = {
      eventId: saved.id,
      occurredAt: saved.createdAt.toISOString(),
      vehicleId: saved.id,
      gpsDeviceId: saved.gpsDeviceId,
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.VEHICLE_REGISTERED,
        event,
      );
    } catch {
      // Vehículo ya creado; tracking sincroniza su caché por eventual consistency.
    }

    return {
      id: saved.id,
      plate: saved.plate,
      type: saved.type,
      capacity: saved.capacity,
      gpsDeviceId: saved.gpsDeviceId,
      available: saved.available,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
