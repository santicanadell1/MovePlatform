import { Category } from '../category.entity';

function makeCategory(overrides: Partial<Parameters<typeof Category.create>[0]> = {}): Category {
  return Category.create({
    id: 'cat-1',
    nameEs: 'Frágil',
    nameEn: 'Fragile',
    description: 'Objetos frágiles que requieren cuidado especial',
    examples: ['cristal', 'cerámica'],
    requiresMonitoring: false,
    generatesAlerts: false,
    surchargePercent: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
}

describe('Category entity', () => {
  describe('create', () => {
    it('preserva todos los campos al construirse', () => {
      const category = makeCategory();

      expect(category.id).toBe('cat-1');
      expect(category.nameEs).toBe('Frágil');
      expect(category.nameEn).toBe('Fragile');
      expect(category.requiresMonitoring).toBe(false);
      expect(category.generatesAlerts).toBe(false);
      expect(category.surchargePercent).toBe(0);
      expect(category.createdAt).toBeInstanceOf(Date);
    });

    it('acepta requiresMonitoring=true al construirse', () => {
      const category = makeCategory({ requiresMonitoring: true });
      expect(category.requiresMonitoring).toBe(true);
    });

    it('acepta generatesAlerts=true al construirse', () => {
      const category = makeCategory({ generatesAlerts: true });
      expect(category.generatesAlerts).toBe(true);
    });
  });

  describe('withRequiresMonitoring', () => {
    it('activa el flag requiresMonitoring', () => {
      const category = makeCategory({ requiresMonitoring: false });
      const updated = category.withRequiresMonitoring(true);

      expect(updated.requiresMonitoring).toBe(true);
    });

    it('desactiva el flag requiresMonitoring', () => {
      const category = makeCategory({ requiresMonitoring: true });
      const updated = category.withRequiresMonitoring(false);

      expect(updated.requiresMonitoring).toBe(false);
    });

    it('no muta la instancia original', () => {
      const category = makeCategory({ requiresMonitoring: false });
      category.withRequiresMonitoring(true);

      expect(category.requiresMonitoring).toBe(false);
    });

    it('conserva los demás campos al actualizar requiresMonitoring', () => {
      const category = makeCategory({ nameEs: 'Peligroso', generatesAlerts: true });
      const updated = category.withRequiresMonitoring(true);

      expect(updated.nameEs).toBe('Peligroso');
      expect(updated.generatesAlerts).toBe(true);
    });
  });

  describe('withGeneratesAlerts', () => {
    it('activa el flag generatesAlerts', () => {
      const category = makeCategory({ generatesAlerts: false });
      const updated = category.withGeneratesAlerts(true);

      expect(updated.generatesAlerts).toBe(true);
    });

    it('desactiva el flag generatesAlerts', () => {
      const category = makeCategory({ generatesAlerts: true });
      const updated = category.withGeneratesAlerts(false);

      expect(updated.generatesAlerts).toBe(false);
    });

    it('no muta la instancia original', () => {
      const category = makeCategory({ generatesAlerts: false });
      category.withGeneratesAlerts(true);

      expect(category.generatesAlerts).toBe(false);
    });
  });

  describe('withSurchargePercent', () => {
    it('actualiza el porcentaje de recargo', () => {
      const category = makeCategory({ surchargePercent: 0 });
      const updated = category.withSurchargePercent(15);

      expect(updated.surchargePercent).toBe(15);
    });

    it('no muta la instancia original', () => {
      const category = makeCategory({ surchargePercent: 0 });
      category.withSurchargePercent(15);

      expect(category.surchargePercent).toBe(0);
    });
  });
});
