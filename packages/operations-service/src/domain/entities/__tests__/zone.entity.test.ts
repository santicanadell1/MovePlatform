import { Zone } from '../zone.entity';
import type { GeoJsonPolygon } from '../zone.entity';

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

function makeZone(overrides: Partial<Parameters<typeof Zone.create>[0]> = {}): Zone {
  return Zone.create({
    id: 'zone-1',
    name: 'Zona Roja Centro',
    type: 'RED',
    geom: SAMPLE_GEOM,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
}

describe('Zone entity', () => {
  describe('create', () => {
    it('preserva todos los campos al construirse', () => {
      const zone = makeZone();

      expect(zone.id).toBe('zone-1');
      expect(zone.name).toBe('Zona Roja Centro');
      expect(zone.type).toBe('RED');
      expect(zone.geom).toEqual(SAMPLE_GEOM);
      expect(zone.createdAt).toBeInstanceOf(Date);
      expect(zone.updatedAt).toBeInstanceOf(Date);
    });

    it('acepta tipo PREFERRED', () => {
      const zone = makeZone({ type: 'PREFERRED' });
      expect(zone.type).toBe('PREFERRED');
    });

    it('preserva la estructura GeoJSON Polygon con coordenadas correctas', () => {
      const zone = makeZone();
      expect(zone.geom.type).toBe('Polygon');
      expect(zone.geom.coordinates).toHaveLength(1);
      expect(zone.geom.coordinates[0]).toHaveLength(5);
    });
  });

  describe('withName', () => {
    it('retorna una nueva zona con el nombre actualizado', () => {
      const original = makeZone();
      const updated = original.withName('Zona Portuaria');

      expect(updated.name).toBe('Zona Portuaria');
      expect(updated.id).toBe(original.id);
    });

    it('no muta la instancia original', () => {
      const original = makeZone();
      original.withName('Otro Nombre');

      expect(original.name).toBe('Zona Roja Centro');
    });
  });

  describe('withType', () => {
    it('cambia el tipo de RED a PREFERRED', () => {
      const zone = makeZone({ type: 'RED' });
      const updated = zone.withType('PREFERRED');

      expect(updated.type).toBe('PREFERRED');
    });

    it('no muta la instancia original', () => {
      const zone = makeZone({ type: 'RED' });
      zone.withType('PREFERRED');

      expect(zone.type).toBe('RED');
    });
  });

  describe('withGeom', () => {
    it('retorna una nueva zona con el polígono actualizado', () => {
      const original = makeZone();
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

      const updated = original.withGeom(newGeom);

      expect(updated.geom).toEqual(newGeom);
      expect(updated.geom).not.toEqual(SAMPLE_GEOM);
    });

    it('no muta la instancia original', () => {
      const original = makeZone();
      const newGeom: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-57.0, -35.0],
            [-56.9, -35.0],
            [-56.9, -34.9],
            [-57.0, -35.0],
          ],
        ],
      };
      original.withGeom(newGeom);

      expect(original.geom).toEqual(SAMPLE_GEOM);
    });

    it('updatedAt cambia tras la actualización de geom', () => {
      const original = makeZone({ updatedAt: new Date('2024-01-01') });
      const newGeom: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-57.0, -35.0],
            [-56.9, -35.0],
            [-56.9, -34.9],
            [-57.0, -35.0],
          ],
        ],
      };
      const updated = original.withGeom(newGeom);

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
    });
  });
});
