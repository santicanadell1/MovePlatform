import { inject, injectable } from 'inversify';

import { IIncidentRepository } from '../ports/incident.repository';
import { ITransferRepository } from '../ports/transfer.repository';
import { Incident } from '../../domain/entities/incident.entity';
import { TYPES } from '../../types';

@injectable()
export class GetIncidentsByTransferUseCase {
  constructor(
    @inject(TYPES.TransferRepository) private readonly transferRepository: ITransferRepository,
    @inject(TYPES.IncidentRepository) private readonly incidentRepository: IIncidentRepository,
  ) {}

  async execute(reservationId: string): Promise<Incident[]> {
    const transfer = await this.transferRepository.findByReservationId(reservationId);
    if (!transfer) return [];
    return this.incidentRepository.findByTransferId(transfer.id);
  }
}
