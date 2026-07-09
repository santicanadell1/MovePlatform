import type { ClassificationResult, ICategorizador } from '../../domain/ports/categorizador.port';

const MIN_CONFIDENCE = 0.5;

export class ClassificationCascadeService {
  constructor(private readonly categorizadores: ICategorizador[]) {}

  async classifySync(description: string): Promise<ClassificationResult | null> {
    const syncOnes = this.categorizadores.filter((c) => !c.isAsync);

    for (const cat of syncOnes) {
      const result = await cat.classify(description);
      if (result !== null && result.confidence >= MIN_CONFIDENCE) {
        return result;
      }
    }

    return null;
  }

  hasSyncCategorizadores(): boolean {
    return this.categorizadores.some((c) => !c.isAsync);
  }
}
