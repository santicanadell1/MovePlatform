import type { PrismaClient } from '../../generated/client';
import type { ICategorizador, ClassificationResult } from '../../domain/ports/categorizador.port';

import { RuleBasedCategorizador } from './rule-based.categorizador';

export class DbRuleBasedCategorizador implements ICategorizador {
  readonly strategy = 'rule-based' as const;
  readonly isAsync = false;

  private inner: RuleBasedCategorizador | null = null;

  constructor(private readonly prisma: PrismaClient) {}

  async classify(description: string): Promise<ClassificationResult | null> {
    if (!this.inner) {
      await this.load();
    }
    return this.inner!.classify(description);
  }

  private async load(): Promise<void> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, nameEs: true, examples: true },
    });

    const rules = categories
      .filter((c) => Array.isArray(c.examples) && (c.examples as string[]).length > 0)
      .map((c) => ({ categoryId: c.id, keywords: c.examples as string[] }));

    this.inner = new RuleBasedCategorizador(rules);
  }
}
