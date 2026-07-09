import type { ICategorizador, ClassificationResult } from '../../domain/ports/categorizador.port';
import type { IEmbeddingService } from '../../domain/ports/embedding.service.port';
import type { ICategoryEmbeddingRepository } from '../../domain/ports/category-embedding.repository.port';
import { logger } from '../logger';

export class EmbeddingsCategorizador implements ICategorizador {
  readonly strategy = 'embeddings' as const;
  readonly isAsync = false;

  constructor(
    private readonly embeddingService: IEmbeddingService,
    private readonly embeddingRepo: ICategoryEmbeddingRepository,
    private readonly similarityThreshold: number = 0.75,
  ) {}

  async classify(description: string): Promise<ClassificationResult | null> {
    try {
      const embedding = await this.embeddingService.embed(description);
      const nearest = await this.embeddingRepo.findNearest(embedding, this.similarityThreshold);
      if (!nearest || nearest.similarity < this.similarityThreshold) {
        logger.debug('Embeddings classification: no match above threshold', {
          description,
          similarity: nearest?.similarity ?? null,
          threshold: this.similarityThreshold,
        });
        return null;
      }
      return {
        categoryId: nearest.categoryId,
        confidence: nearest.similarity,
        strategy: 'embeddings',
      };
    } catch (err) {
      logger.warn('Embeddings classification failed', {
        description,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}
