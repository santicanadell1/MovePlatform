import { Zone } from '../../../domain/entities/zone.entity';
import type { GeoJsonPolygon } from '../../../domain/entities/zone.entity';
import { ZoneNotFoundError } from '../../../domain/errors/zone.errors';
import { CreateZoneUseCase } from '../zones/create-zone.use-case';
import { DeleteZoneUseCase } from '../zones/delete-zone.use-case';
import { GetZonesUseCase } from '../zones/get-zones.use-case';
import { UpdateZoneUseCase } from '../zones/update-zone.use-case';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port';

import { InMemoryZoneRepository } from './doubles/in-memory-zone.repository';

const noOpPublisher: IEventPublisher = { publish: () => Promise.resolve() };

const SAMPLE_GEOM: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-56.2, -34.9],
      [-56.1, -34.9],
      [-56.1, -34.8],
      [-56.2, -34.8],
      [-56.2, -34.9],
    ],
  ],
};

const makeZone = (overrides: Partial<Zone> = {}): Zone =>
  Zone.create({
    id: 'zone-1',
    name: 'Zona Roja Centro',
    type: 'RED',
    geom: SAMPLE_GEOM,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ---------------------------------------------------------------------------
// GetZonesUseCase
// ---------------------------------------------------------------------------

describe('GetZonesUseCase', () => {
  it('retorna lista vacía cuando no hay zonas', async () => {
    const repo = new InMemoryZoneRepository();
    const result = await new GetZonesUseCase(repo).execute();
    expect(result).toHaveLength(0);
  });

  it('retorna todas las zonas con sus datos completos', async () => {
    const repo = new InMemoryZoneRepository();
    repo.seed([
      makeZone(),
      makeZone({ id: 'zone-2', name: 'Zona Preferida Norte', type: 'PREFERRED' }),
    ]);

    const result = await new GetZonesUseCase(repo).execute();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Zona Roja Centro');
    expect(result[1].type).toBe('PREFERRED');
  });

  it('incluye el campo geom en la salida', async () => {
    const repo = new InMemoryZoneRepository();
    repo.seed([makeZone()]);

    const result = await new GetZonesUseCase(repo).execute();

    expect(result[0].geom).toEqual(SAMPLE_GEOM);
  });
});

// ---------------------------------------------------------------------------
// CreateZoneUseCase
// ---------------------------------------------------------------------------

describe('CreateZoneUseCase', () => {
  let repo: InMemoryZoneRepository;
  let useCase: CreateZoneUseCase;

  beforeEach(() => {
    repo = new InMemoryZoneRepository();
    useCase = new CreateZoneUseCase(repo, noOpPublisher);
  });

  it('crea una zona RED con los datos correctos', async () => {
    const result = await useCase.execute({
      name: 'Zona Roja Centro',
      type: 'RED',
      geom: SAMPLE_GEOM,
    });

    expect(result.name).toBe('Zona Roja Centro');
    expect(result.type).toBe('RED');
    expect(result.geom).toEqual(SAMPLE_GEOM);
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('crea una zona PREFERRED correctamente', async () => {
    const result = await useCase.execute({
      name: 'Zona Preferida Aeropuerto',
      type: 'PREFERRED',
      geom: SAMPLE_GEOM,
    });
    expect(result.type).toBe('PREFERRED');
  });

  it('persiste la zona en el repositorio', async () => {
    await useCase.execute({ name: 'Nueva Zona', type: 'RED', geom: SAMPLE_GEOM });
    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Nueva Zona');
  });
});

// ---------------------------------------------------------------------------
// UpdateZoneUseCase
// ---------------------------------------------------------------------------

describe('UpdateZoneUseCase', () => {
  let repo: InMemoryZoneRepository;
  let useCase: UpdateZoneUseCase;

  beforeEach(() => {
    repo = new InMemoryZoneRepository();
    useCase = new UpdateZoneUseCase(repo, noOpPublisher);
  });

  it('actualiza el nombre de la zona', async () => {
    repo.seed([makeZone()]);
    const result = await useCase.execute({ zoneId: 'zone-1', name: 'Nuevo Nombre' });
    expect(result.name).toBe('Nuevo Nombre');
  });

  it('actualiza el tipo de la zona', async () => {
    repo.seed([makeZone()]);
    const result = await useCase.execute({ zoneId: 'zone-1', type: 'PREFERRED' });
    expect(result.type).toBe('PREFERRED');
  });

  it('actualiza el polígono geom', async () => {
    repo.seed([makeZone()]);
    const newGeom: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-57.0, -35.0],
          [-56.9, -35.0],
          [-56.9, -34.9],
          [-57.0, -34.9],
          [-57.0, -35.0],
        ],
      ],
    };
    const result = await useCase.execute({ zoneId: 'zone-1', geom: newGeom });
    expect(result.geom).toEqual(newGeom);
  });

  it('lanza ZoneNotFoundError si la zona no existe', async () => {
    await expect(useCase.execute({ zoneId: 'no-existe', name: 'Algo' })).rejects.toBeInstanceOf(
      ZoneNotFoundError,
    );
  });

  it('updatedAt cambia tras la actualización', async () => {
    const originalDate = new Date('2024-01-01');
    repo.seed([makeZone({ updatedAt: originalDate })]);
    const result = await useCase.execute({ zoneId: 'zone-1', name: 'Nuevo nombre' });
    expect(result.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
  });
});

// ---------------------------------------------------------------------------
// DeleteZoneUseCase
// ---------------------------------------------------------------------------

describe('DeleteZoneUseCase', () => {
  let repo: InMemoryZoneRepository;
  let useCase: DeleteZoneUseCase;

  beforeEach(() => {
    repo = new InMemoryZoneRepository();
    useCase = new DeleteZoneUseCase(repo, noOpPublisher);
  });

  it('elimina la zona correctamente', async () => {
    repo.seed([makeZone()]);
    await expect(useCase.execute({ zoneId: 'zone-1' })).resolves.toBeUndefined();
  });

  it('la zona ya no existe después de eliminar', async () => {
    repo.seed([makeZone()]);
    await useCase.execute({ zoneId: 'zone-1' });
    expect(await repo.findAll()).toHaveLength(0);
  });

  it('lanza ZoneNotFoundError si la zona no existe', async () => {
    await expect(useCase.execute({ zoneId: 'no-existe' })).rejects.toBeInstanceOf(
      ZoneNotFoundError,
    );
  });
});
