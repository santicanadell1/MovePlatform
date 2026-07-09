import type { ActiveTransferData } from '../../../domain/ports/active-transfers.repository.port';
import { GetActiveTransfersUseCase } from '../operations/get-active-transfers.use-case';

import { InMemoryActiveTransfersRepository } from './doubles/in-memory-active-transfers.repository';

const makeTransfer = (overrides: Partial<ActiveTransferData> = {}): ActiveTransferData => ({
  id: 'tr-1',
  reservationId: 'res-1',
  origin: 'Centro',
  destination: 'Aeropuerto',
  status: 'IN_TRANSIT',
  vehicle: { id: 'v-1', plate: 'VAN-12' },
  conductor: { id: 'c-1', name: 'Laura Silva' },
  activeAlerts: [],
  createdAt: new Date('2026-05-01T10:00:00Z'),
  ...overrides,
});

describe('GetActiveTransfersUseCase', () => {
  let repo: InMemoryActiveTransfersRepository;
  let useCase: GetActiveTransfersUseCase;

  beforeEach(() => {
    repo = new InMemoryActiveTransfersRepository();
    useCase = new GetActiveTransfersUseCase(repo);
  });

  it('retorna lista vacía cuando no hay traslados', async () => {
    const result = await useCase.execute({ limit: 20 });
    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('retorna todos los traslados sin filtros', async () => {
    repo.seed([makeTransfer({ id: 'tr-1' }), makeTransfer({ id: 'tr-2', reservationId: 'res-2' })]);
    const result = await useCase.execute({ limit: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('filtra por status', async () => {
    repo.seed([
      makeTransfer({ id: 'tr-1', status: 'IN_TRANSIT' }),
      makeTransfer({ id: 'tr-2', reservationId: 'res-2', status: 'COMPLETED' }),
    ]);
    const result = await useCase.execute({ status: 'IN_TRANSIT', limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('tr-1');
  });

  it('filtra por vehicleId', async () => {
    repo.seed([
      makeTransfer({ id: 'tr-1', vehicle: { id: 'v-1', plate: 'VAN-12' } }),
      makeTransfer({ id: 'tr-2', reservationId: 'res-2', vehicle: { id: 'v-2', plate: 'AUTO-5' } }),
    ]);
    const result = await useCase.execute({ vehicleId: 'v-1', limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vehicle.plate).toBe('VAN-12');
  });

  it('filtra por conductorId', async () => {
    repo.seed([
      makeTransfer({ id: 'tr-1', conductor: { id: 'c-1', name: 'Laura' } }),
      makeTransfer({
        id: 'tr-2',
        reservationId: 'res-2',
        conductor: { id: 'c-2', name: 'Martín' },
      }),
    ]);
    const result = await useCase.execute({ conductorId: 'c-2', limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].conductor.name).toBe('Martín');
  });

  it('filtra hasAlerts=true: solo traslados con alertas', async () => {
    repo.seed([
      makeTransfer({
        id: 'tr-1',
        activeAlerts: [
          { id: 'a-1', type: 'ZONE_RED_ENTRY', message: 'Zona roja', lat: -34.9011, lng: -56.1645 },
        ],
      }),
      makeTransfer({ id: 'tr-2', reservationId: 'res-2', activeAlerts: [] }),
    ]);
    const result = await useCase.execute({ hasAlerts: true, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('tr-1');
  });

  it('filtra hasAlerts=false: solo traslados sin alertas', async () => {
    repo.seed([
      makeTransfer({
        id: 'tr-1',
        activeAlerts: [
          { id: 'a-1', type: 'ZONE_RED_ENTRY', message: 'Zona roja', lat: -34.9011, lng: -56.1645 },
        ],
      }),
      makeTransfer({ id: 'tr-2', reservationId: 'res-2', activeAlerts: [] }),
    ]);
    const result = await useCase.execute({ hasAlerts: false, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('tr-2');
  });

  it('paginación: retorna nextCursor cuando hay más resultados que el límite', async () => {
    repo.seed([
      makeTransfer({ id: 'tr-1', createdAt: new Date('2026-05-01T12:00:00Z') }),
      makeTransfer({
        id: 'tr-2',
        reservationId: 'res-2',
        createdAt: new Date('2026-05-01T11:00:00Z'),
      }),
      makeTransfer({
        id: 'tr-3',
        reservationId: 'res-3',
        createdAt: new Date('2026-05-01T10:00:00Z'),
      }),
    ]);
    const page1 = await useCase.execute({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].id).toBe('tr-1');
    expect(page1.items[1].id).toBe('tr-2');
    expect(page1.nextCursor).not.toBeNull();
  });

  it('paginación: la segunda página trae el resto usando el cursor', async () => {
    repo.seed([
      makeTransfer({ id: 'tr-1', createdAt: new Date('2026-05-01T12:00:00Z') }),
      makeTransfer({
        id: 'tr-2',
        reservationId: 'res-2',
        createdAt: new Date('2026-05-01T11:00:00Z'),
      }),
      makeTransfer({
        id: 'tr-3',
        reservationId: 'res-3',
        createdAt: new Date('2026-05-01T10:00:00Z'),
      }),
    ]);
    const page1 = await useCase.execute({ limit: 2 });
    const page2 = await useCase.execute({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe('tr-3');
    expect(page2.nextCursor).toBeNull();
  });

  it('paginación: no retorna nextCursor cuando los resultados caben en una página', async () => {
    repo.seed([makeTransfer({ id: 'tr-1' })]);
    const result = await useCase.execute({ limit: 20 });
    expect(result.nextCursor).toBeNull();
  });
});
