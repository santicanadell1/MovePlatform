import { TransferStatus } from '@move/shared';

import { IEventPublisher } from '../../ports/event-publisher';
import { IIncidentRepository } from '../../ports/incident.repository';
import { ITransferRepository } from '../../ports/transfer.repository';
import { Transfer } from '../../../domain/entities/transfer.entity';
import { Incident } from '../../../domain/entities/incident.entity';
import {
  IncidentConductorMismatchError,
  IncidentTransferNotFoundError,
  IncidentTransferNotInTransitError,
} from '../../../domain/errors/incident.errors';
import { ReportIncidentUseCase } from '../report-incident.use-case';

function makeTransfer(overrides: Partial<{
  conductorId: string;
  status: TransferStatus;
}> = {}) {
  return new Transfer({
    id: 'transfer-001',
    reservationId: 'reservation-001',
    vehicleId: 'vehicle-001',
    conductorId: overrides.conductorId ?? 'conductor-001',
    status: overrides.status ?? TransferStatus.IN_TRANSIT,
    startedAt: new Date(),
    finishedAt: null,
    createdAt: new Date(),
  });
}

function makeUseCase(transfer: Transfer | null) {
  const published: unknown[] = [];

  const transferRepository: ITransferRepository = {
    findByReservationId: () => Promise.resolve(transfer),
    findActiveByVehicleId: () => Promise.resolve(null),
    save: (t) => Promise.resolve(t),
    update: (t) => Promise.resolve(t),
  };

  const incidentRepository: IIncidentRepository = {
    save: (incident: Incident) => Promise.resolve(incident),
    findByTransferId: () => Promise.resolve([]),
  };

  const eventPublisher: IEventPublisher = {
    publish: () => { published.push(true); return Promise.resolve(); },
  };

  const useCase = new ReportIncidentUseCase(
    transferRepository,
    incidentRepository,
    eventPublisher,
  );

  return { useCase, published };
}

const input = {
  reservationId: 'reservation-001',
  conductorId: 'conductor-001',
  description: 'Llanta pinchada en av. 18 de julio',
};

describe('ReportIncidentUseCase', () => {
  it('lanza IncidentTransferNotFoundError si no existe el traslado', async () => {
    const { useCase } = makeUseCase(null);
    await expect(useCase.execute(input)).rejects.toThrow(IncidentTransferNotFoundError);
  });

  it('lanza IncidentConductorMismatchError si el conductor no coincide', async () => {
    const transfer = makeTransfer({ conductorId: 'otro-conductor' });
    const { useCase } = makeUseCase(transfer);
    await expect(useCase.execute(input)).rejects.toThrow(IncidentConductorMismatchError);
  });

  it('lanza IncidentTransferNotInTransitError si el traslado no está IN_TRANSIT', async () => {
    const transfer = makeTransfer({ status: TransferStatus.COMPLETED });
    const { useCase } = makeUseCase(transfer);
    await expect(useCase.execute(input)).rejects.toThrow(IncidentTransferNotInTransitError);
  });

  it('guarda la incidencia y publica el evento', async () => {
    const transfer = makeTransfer();
    const { useCase, published } = makeUseCase(transfer);

    const result = await useCase.execute(input);

    expect(result.incidentId).toBeDefined();
    expect(result.transferId).toBe('transfer-001');
    expect(published).toHaveLength(1);
  });
});
