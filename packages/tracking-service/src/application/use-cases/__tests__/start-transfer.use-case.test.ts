import { v4 as uuidv4 } from 'uuid';
import { TransferStatus } from '@move/shared';

import { Transfer } from '../../../domain/entities/transfer.entity';
import {
  VehicleAlreadyInTransitError,
  VehicleNotRegisteredError,
} from '../../../domain/errors/transfer.errors';
import type { ITransferRepository } from '../../ports/transfer.repository';
import type { ICacheService } from '../../ports/cache.service';
import type { IEventPublisher } from '../../ports/event-publisher';
import type {
  IVehicleRegistryRepository,
  VehicleRegistryEntry,
} from '../../ports/vehicle-registry.repository';
import { StartTransferUseCase } from '../start-transfer.use-case';

const noOpPublisher: IEventPublisher = { publish: () => Promise.resolve() };

function makeTransferRepo(
  active: Transfer | null = null,
  existing: Transfer | null = null,
): ITransferRepository {
  return {
    findActiveByVehicleId: () => Promise.resolve(active),
    findByReservationId: () => Promise.resolve(existing),
    save: (t: Transfer) => Promise.resolve(t),
    update: (t: Transfer) => Promise.resolve(t),
  };
}

function makeCache(): ICacheService {
  const keys: Map<string, string> = new Map();
  return {
    get: (key: string) => Promise.resolve(keys.get(key) ?? null),
    // eslint-disable-next-line @typescript-eslint/require-await
    set: async (key: string, value: string) => {
      keys.set(key, value);
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    delete: async (key: string) => {
      keys.delete(key);
    },
  };
}

function makeVehicleRegistry(found = true): IVehicleRegistryRepository {
  return {
    findVehicleById: () =>
      Promise.resolve(
        found ? ({ vehicleId: 'v-1', gpsDeviceId: 'gps-1' } as VehicleRegistryEntry) : null,
      ),
    findVehicleByGpsDeviceId: () => Promise.resolve(null),
  };
}

const baseInput = {
  reservationId: 'res-1',
  conductorId: 'cond-1',
  vehicleId: 'v-1',
  deviceId: 'gps-1',
};

describe('StartTransferUseCase', () => {
  it('lanza VehicleNotRegisteredError si vehicleId no existe en operations.vehicles', async () => {
    const useCase = new StartTransferUseCase(
      makeTransferRepo(),
      makeCache(),
      makeVehicleRegistry(false),
      noOpPublisher,
    );

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(VehicleNotRegisteredError);
  });

  it('lanza VehicleAlreadyInTransitError si el vehículo ya tiene un traslado activo', async () => {
    const activeTransfer = new Transfer({
      id: uuidv4(),
      reservationId: 'res-other',
      vehicleId: 'v-1',
      conductorId: 'cond-1',
      status: TransferStatus.IN_TRANSIT,
      startedAt: new Date(),
      finishedAt: null,
      createdAt: new Date(),
    });
    const useCase = new StartTransferUseCase(
      makeTransferRepo(activeTransfer),
      makeCache(),
      makeVehicleRegistry(true),
      noOpPublisher,
    );

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(VehicleAlreadyInTransitError);
  });

  it('crea y arranca el traslado cuando el vehículo está registrado y libre', async () => {
    const cache = makeCache();
    const useCase = new StartTransferUseCase(
      makeTransferRepo(),
      cache,
      makeVehicleRegistry(true),
      noOpPublisher,
    );

    const result = await useCase.execute(baseInput);

    expect(result.reservationId).toBe('res-1');
    expect(result.status).toBe(TransferStatus.IN_TRANSIT);
    const cached = await cache.get('transfer:active:gps-1');
    expect(cached).toBe(result.transferId);
  });
});
