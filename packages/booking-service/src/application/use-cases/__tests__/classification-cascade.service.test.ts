import { ClassificationCascadeService } from '../../services/classification-cascade.service';
import type {
  ClassificationResult,
  ICategorizador,
} from '../../../domain/ports/categorizador.port';

const makeCategorizador = (
  strategy: ClassificationResult['strategy'],
  isAsync: boolean,
  result: ClassificationResult | null,
): ICategorizador => ({
  strategy,
  isAsync,
  classify: jest.fn().mockResolvedValue(result),
});

const MATCH: ClassificationResult = {
  categoryId: 'cat-1',
  confidence: 0.9,
  strategy: 'rule-based',
};
const LOW_CONFIDENCE: ClassificationResult = {
  categoryId: 'cat-1',
  confidence: 0.3,
  strategy: 'rule-based',
};

describe('ClassificationCascadeService', () => {
  describe('classify (sync cascade)', () => {
    it('retorna el resultado del primer categorizador que clasifica', async () => {
      const ruleB = makeCategorizador('rule-based', false, MATCH);
      const embed = makeCategorizador('embeddings', false, null);
      const svc = new ClassificationCascadeService([ruleB, embed]);

      const result = await svc.classifySync('mudanza de muebles');

      expect(result).toEqual(MATCH);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(embed.classify).not.toHaveBeenCalled();
    });

    it('pasa al siguiente si el primero retorna null', async () => {
      const embedMatch: ClassificationResult = {
        categoryId: 'cat-2',
        confidence: 0.88,
        strategy: 'embeddings',
      };
      const ruleB = makeCategorizador('rule-based', false, null);
      const embed = makeCategorizador('embeddings', false, embedMatch);
      const svc = new ClassificationCascadeService([ruleB, embed]);

      const result = await svc.classifySync('traslado de equipos');

      expect(result).toEqual(embedMatch);
    });

    it('pasa al siguiente si la confianza está por debajo del umbral mínimo', async () => {
      const embedMatch: ClassificationResult = {
        categoryId: 'cat-2',
        confidence: 0.88,
        strategy: 'embeddings',
      };
      const ruleB = makeCategorizador('rule-based', false, LOW_CONFIDENCE);
      const embed = makeCategorizador('embeddings', false, embedMatch);
      const svc = new ClassificationCascadeService([ruleB, embed]);

      const result = await svc.classifySync('texto ambiguo');

      expect(result).toEqual(embedMatch);
    });

    it('retorna null si ningún categorizador sync clasifica', async () => {
      const ruleB = makeCategorizador('rule-based', false, null);
      const embed = makeCategorizador('embeddings', false, null);
      const svc = new ClassificationCascadeService([ruleB, embed]);

      const result = await svc.classifySync('descripción sin categoría');

      expect(result).toBeNull();
    });

    it('omite categorizadores async en la cascada sync', async () => {
      const llm = makeCategorizador('llm', true, MATCH);
      const ruleB = makeCategorizador('rule-based', false, null);
      const svc = new ClassificationCascadeService([llm, ruleB]);

      await svc.classifySync('descripción');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llm.classify).not.toHaveBeenCalled();
    });
  });

  describe('hasSyncCategorizadores', () => {
    it('retorna true si hay al menos un categorizador no async', () => {
      const svc = new ClassificationCascadeService([makeCategorizador('rule-based', false, null)]);
      expect(svc.hasSyncCategorizadores()).toBe(true);
    });

    it('retorna false si todos son async', () => {
      const svc = new ClassificationCascadeService([makeCategorizador('llm', true, null)]);
      expect(svc.hasSyncCategorizadores()).toBe(false);
    });
  });
});
