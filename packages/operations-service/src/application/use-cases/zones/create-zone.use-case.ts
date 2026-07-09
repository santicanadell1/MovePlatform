import { randomUUID } from 'crypto';

import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS, type ZoneCreatedEvent } from '@move/shared';
import { injectable, inject } from 'inversify';

import { Zone } from '../../../domain/entities/zone.entity';
import type { GeoJsonPolygon } from '../../../domain/entities/zone.entity';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import type { IZoneRepository } from '../../../domain/ports/zone.repository.port';
import { TYPES } from '../../../types';

export interface CreateZoneInput {
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geom: GeoJsonPolygon;
}

export interface CreateZoneOutput {
  readonly id: string;
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geom: GeoJsonPolygon;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class CreateZoneUseCase {
  constructor(
    @inject(TYPES.ZoneRepository)
    private readonly zoneRepo: IZoneRepository,
    @inject(TYPES.EventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: CreateZoneInput): Promise<CreateZoneOutput> {
    const now = new Date();
    const zone = Zone.create({
      id: randomUUID(),
      name: input.name,
      type: input.type,
      geom: input.geom,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.zoneRepo.create(zone);

    const event: ZoneCreatedEvent = {
      eventId: saved.id,
      occurredAt: now.toISOString(),
      zoneId: saved.id,
      name: saved.name,
      type: saved.type,
      geojson: JSON.stringify(saved.geom),
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.ZONE_CREATED,
        event,
      );
    } catch {
      // Zona ya creada; tracking sincroniza su caché Redis por eventual consistency.
    }

    return {
      id: saved.id,
      name: saved.name,
      type: saved.type,
      geom: saved.geom,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
