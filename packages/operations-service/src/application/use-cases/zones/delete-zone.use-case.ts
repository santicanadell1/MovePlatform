import { randomUUID } from 'crypto';

import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS, type ZoneDeletedEvent } from '@move/shared';
import { injectable, inject } from 'inversify';

import { ZoneNotFoundError } from '../../../domain/errors/zone.errors';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';
import type { IZoneRepository } from '../../../domain/ports/zone.repository.port';
import { TYPES } from '../../../types';

export interface DeleteZoneInput {
  readonly zoneId: string;
}

@injectable()
export class DeleteZoneUseCase {
  constructor(
    @inject(TYPES.ZoneRepository)
    private readonly zoneRepo: IZoneRepository,
    @inject(TYPES.EventPublisher)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: DeleteZoneInput): Promise<void> {
    const zone = await this.zoneRepo.findById(input.zoneId);
    if (!zone) throw new ZoneNotFoundError(input.zoneId);
    await this.zoneRepo.delete(input.zoneId);

    const event: ZoneDeletedEvent = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      zoneId: input.zoneId,
    };
    try {
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.ZONE_DELETED,
        event,
      );
    } catch {
      // Zona ya eliminada; tracking sincroniza su caché Redis por eventual consistency.
    }
  }
}
