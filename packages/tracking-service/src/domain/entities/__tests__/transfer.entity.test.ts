import { TransferStatus } from '@move/shared';

import { Transfer } from '../transfer.entity';

function makeTransfer(status: TransferStatus = TransferStatus.PENDING): Transfer {
  return new Transfer({
    id: 'transfer-001',
    reservationId: 'reservation-001',
    vehicleId: 'vehicle-001',
    conductorId: 'conductor-001',
    status,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-01-01'),
  });
}

describe('Transfer entity', () => {
  describe('isPending', () => {
    it('retorna true cuando el status es PENDING', () => {
      expect(makeTransfer(TransferStatus.PENDING).isPending()).toBe(true);
    });

    it('retorna false cuando el status no es PENDING', () => {
      expect(makeTransfer(TransferStatus.IN_TRANSIT).isPending()).toBe(false);
    });
  });

  describe('isInTransit', () => {
    it('retorna true cuando el status es IN_TRANSIT', () => {
      expect(makeTransfer(TransferStatus.IN_TRANSIT).isInTransit()).toBe(true);
    });

    it('retorna false cuando el status no es IN_TRANSIT', () => {
      expect(makeTransfer(TransferStatus.PENDING).isInTransit()).toBe(false);
    });
  });

  describe('belongsToConductor', () => {
    it('retorna true cuando el conductorId coincide', () => {
      expect(makeTransfer().belongsToConductor('conductor-001')).toBe(true);
    });

    it('retorna false cuando el conductorId no coincide', () => {
      expect(makeTransfer().belongsToConductor('otro-conductor')).toBe(false);
    });
  });

  describe('start', () => {
    it('retorna un nuevo Transfer con status IN_TRANSIT y startedAt seteado', () => {
      const transfer = makeTransfer(TransferStatus.PENDING);
      const started = transfer.start();

      expect(started.status).toBe(TransferStatus.IN_TRANSIT);
      expect(started.startedAt).not.toBeNull();
    });

    it('no muta la instancia original', () => {
      const transfer = makeTransfer(TransferStatus.PENDING);
      transfer.start();

      expect(transfer.status).toBe(TransferStatus.PENDING);
      expect(transfer.startedAt).toBeNull();
    });
  });

  describe('finish', () => {
    it('retorna un nuevo Transfer con status COMPLETED y finishedAt seteado', () => {
      const transfer = makeTransfer(TransferStatus.IN_TRANSIT);
      const finished = transfer.finish();

      expect(finished.status).toBe(TransferStatus.COMPLETED);
      expect(finished.finishedAt).not.toBeNull();
    });

    it('no muta la instancia original', () => {
      const transfer = makeTransfer(TransferStatus.IN_TRANSIT);
      transfer.finish();

      expect(transfer.status).toBe(TransferStatus.IN_TRANSIT);
      expect(transfer.finishedAt).toBeNull();
    });
  });
});
