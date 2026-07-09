import { randomUUID } from 'crypto';

import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS, type ZoneUpdatedEvent } from '@move/shared';
import { injectable, inject } from 'inversify';

import type { GeoJsonPolygon } from '../../../domain/entities/zone.entity';
import { ZoneNotFoundError } from '../../../domain/errors/zone.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import type { IZoneRepository } from '../../../domain/ports/zone.repository.port';
import { TYPES } from '../../../types';

export interface UpdateZoneInput {
  readonly zoneId: string;
  readonly name?: string;
  readonly type?: 'RED' | 'PREFERRED';
  readonly geom?: GeoJsonPolygon;
}

export interface UpdateZoneOutput {
  readonly id: string;
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geom: GeoJsonPolygon;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class UpdateZoneUseCase {
  constructor(
    @inject(TYPES.ZoneRepository)
    private readonly zoneRepo: IZoneRepository,
    @inject(TYPES.EventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: UpdateZoneInput): Promise<UpdateZoneOutput> {
    let zone = await this.zoneRepo.findById(input.zoneId);
    if (!zone) throw new ZoneNotFoundError(input.zoneId);

    if (input.name !== undefined) zone = zone.withName(input.name);
    if (input.type !== undefined) zone = zone.withType(input.type);
    if (input.geom !== undefined) zone = zone.withGeom(input.geom);

    const saved = await this.zoneRepo.update(zone);

    const event: ZoneUpdatedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      zoneId: saved.id,
      name: saved.name,
      type: saved.type,
      geojson: JSON.stringify(saved.geom),
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.ZONE_UPDATED,
        event,
      );
    } catch {
      // Zona ya actualizada; tracking sincroniza su caché Redis por eventual consistency.
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
