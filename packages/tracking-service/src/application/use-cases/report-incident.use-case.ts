import { randomUUID } from 'crypto';

import { inject, injectable } from 'inversify';
import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS, IncidentReportedEvent } from '@move/shared';

import { IEventPublisher } from '../ports/event-publisher';
import { IIncidentRepository } from '../ports/incident.repository';
import { ITransferRepository } from '../ports/transfer.repository';
import { Incident } from '../../domain/entities/incident.entity';
import {
  IncidentConductorMismatchError,
  IncidentTransferNotFoundError,
  IncidentTransferNotInTransitError,
} from '../../domain/errors/incident.errors';
import { TYPES } from '../../types';

export interface ReportIncidentInput {
  readonly reservationId: string;
  readonly conductorId: string;
  readonly description: string;
}

export interface ReportIncidentOutput {
  readonly incidentId: string;
  readonly transferId: string;
  readonly createdAt: Date;
}

@injectable()
export class ReportIncidentUseCase {
  constructor(
    @inject(TYPES.TransferRepository) private readonly transferRepository: ITransferRepository,
    @inject(TYPES.IncidentRepository) private readonly incidentRepository: IIncidentRepository,
    @inject(TYPES.EventPublisher) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: ReportIncidentInput): Promise<ReportIncidentOutput> {
    const transfer = await this.transferRepository.findByReservationId(input.reservationId);

    if (!transfer) {
      throw new IncidentTransferNotFoundError(input.reservationId);
    }

    if (!transfer.belongsToConductor(input.conductorId)) {
      throw new IncidentConductorMismatchError();
    }

    if (!transfer.isInTransit()) {
      throw new IncidentTransferNotInTransitError(transfer.id);
    }

    const incident = new Incident({
      id: randomUUID(),
      transferId: transfer.id,
      conductorId: input.conductorId,
      description: input.description,
      createdAt: new Date(),
    });

    const saved = await this.incidentRepository.save(incident);

    const event: IncidentReportedEvent = {
      eventId: saved.id,
      occurredAt: saved.createdAt.toISOString(),
      incidentId: saved.id,
      transferId: saved.transferId,
      conductorId: saved.conductorId,
      description: saved.description,
    };

    await this.eventPublisher.publish(
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.INCIDENT_REPORTED,
      event,
    );

    return {
      incidentId: saved.id,
      transferId: saved.transferId,
      createdAt: saved.createdAt,
    };
  }
}
