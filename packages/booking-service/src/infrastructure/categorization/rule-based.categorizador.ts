import type { ClassificationResult, ICategorizador } from '../../domain/ports/categorizador.port';

export interface CategoryKeywords {
  readonly categoryId: string;
  readonly keywords: readonly string[];
}

export class RuleBasedCategorizador implements ICategorizador {
  readonly strategy = 'rule-based' as const;
  readonly isAsync = false;

  constructor(private readonly rules: CategoryKeywords[]) {}

  classify(description: string): Promise<ClassificationResult | null> {
    const normalized = description.toLowerCase();
    const tokens = normalized.split(/\s+/);

    let bestCategoryId: string | null = null;
    let bestMatches = 0;
    let bestTotalKeywords = 1;

    for (const rule of this.rules) {
      const matches = rule.keywords.filter((kw) => tokens.includes(kw.toLowerCase())).length;
      if (matches > bestMatches) {
        bestMatches = matches;
        bestCategoryId = rule.categoryId;
        bestTotalKeywords = rule.keywords.length;
      }
    }

    if (bestCategoryId === null || bestMatches === 0) {
      return Promise.resolve(null);
    }

    const confidence = Math.min(bestMatches / bestTotalKeywords, 1);

    return Promise.resolve({
      categoryId: bestCategoryId,
      confidence,
      strategy: 'rule-based',
    });
  }
}
