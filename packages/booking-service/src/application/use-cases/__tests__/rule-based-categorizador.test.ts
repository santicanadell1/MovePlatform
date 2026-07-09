import { RuleBasedCategorizador } from '../../../infrastructure/categorization/rule-based.categorizador';

describe('RuleBasedCategorizador (2.5)', () => {
  const categorizador = new RuleBasedCategorizador([
    { categoryId: 'cat-mudanza', keywords: ['mudanza', 'muebles', 'cajas', 'traslado'] },
    {
      categoryId: 'cat-electronica',
      keywords: ['computadora', 'monitor', 'electronica', 'laptop'],
    },
    { categoryId: 'cat-alimentos', keywords: ['alimentos', 'comida', 'frigorifico', 'nevera'] },
  ]);

  it('clasifica correctamente cuando hay match de keywords', async () => {
    const result = await categorizador.classify('necesito trasladar muebles y cajas de mudanza');

    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe('cat-mudanza');
    expect(result!.strategy).toBe('rule-based');
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('retorna la categoría con más matches cuando hay varias', async () => {
    const result = await categorizador.classify('traslado de computadora y monitor y laptop');

    expect(result!.categoryId).toBe('cat-electronica');
  });

  it('la confianza es proporcional a los matches', async () => {
    const one = await categorizador.classify('mudanza');
    const two = await categorizador.classify('mudanza muebles');

    expect(two!.confidence).toBeGreaterThan(one!.confidence);
  });

  it('retorna null si ninguna keyword hace match', async () => {
    const result = await categorizador.classify('servicio de fontaneria urgente');

    expect(result).toBeNull();
  });

  it('es case-insensitive', async () => {
    const result = await categorizador.classify('MUDANZA de MUEBLES');

    expect(result!.categoryId).toBe('cat-mudanza');
  });

  it('tiene strategy rule-based e isAsync false', () => {
    expect(categorizador.strategy).toBe('rule-based');
    expect(categorizador.isAsync).toBe(false);
  });
});
