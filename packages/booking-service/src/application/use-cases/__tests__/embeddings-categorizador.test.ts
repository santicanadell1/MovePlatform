import type { IEmbeddingService } from '../../../domain/ports/embedding.service.port';
import type {
  ICategoryEmbeddingRepository,
  NearestCategoryResult,
} from '../../../domain/ports/category-embedding.repository.port';
import { EmbeddingsCategorizador } from '../../../infrastructure/categorization/embeddings.categorizador';

class FakeEmbeddingService implements IEmbeddingService {
  embed(_text: string): Promise<number[]> {
    return Promise.resolve([0.1, 0.2, 0.3]);
  }
}

class FakeCategoryEmbeddingRepository implements ICategoryEmbeddingRepository {
  constructor(private readonly nearest: NearestCategoryResult | null) {}

  findNearest(_embedding: number[], _threshold: number): Promise<NearestCategoryResult | null> {
    return Promise.resolve(this.nearest);
  }

  findNearestTopK(_embedding: number[], _limit: number): Promise<NearestCategoryResult[]> {
    return Promise.resolve(this.nearest ? [this.nearest] : []);
  }
}

describe('EmbeddingsCategorizador (2.4)', () => {
  const embeddingService = new FakeEmbeddingService();

  it('clasifica correctamente cuando hay una categoría similar por encima del umbral', async () => {
    const repo = new FakeCategoryEmbeddingRepository({
      categoryId: 'cat-electronica',
      similarity: 0.92,
    });
    const categorizador = new EmbeddingsCategorizador(embeddingService, repo);

    const result = await categorizador.classify('computadora portátil para traslado');

    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe('cat-electronica');
    expect(result!.confidence).toBe(0.92);
    expect(result!.strategy).toBe('embeddings');
  });

  it('retorna null cuando la similitud está por debajo del umbral', async () => {
    const repo = new FakeCategoryEmbeddingRepository({ categoryId: 'cat-any', similarity: 0.5 });
    const categorizador = new EmbeddingsCategorizador(embeddingService, repo, 0.75);

    const result = await categorizador.classify('algo poco relacionado');

    expect(result).toBeNull();
  });

  it('retorna null cuando no hay categorías en la base de datos', async () => {
    const repo = new FakeCategoryEmbeddingRepository(null);
    const categorizador = new EmbeddingsCategorizador(embeddingService, repo);

    const result = await categorizador.classify('cualquier descripción');

    expect(result).toBeNull();
  });

  it('tiene strategy embeddings e isAsync false', () => {
    const repo = new FakeCategoryEmbeddingRepository(null);
    const categorizador = new EmbeddingsCategorizador(embeddingService, repo);

    expect(categorizador.strategy).toBe('embeddings');
    expect(categorizador.isAsync).toBe(false);
  });

  it('pasa el umbral correcto al repositorio', async () => {
    const calls: Array<{ embedding: number[]; threshold: number }> = [];
    const repo: ICategoryEmbeddingRepository = {
      findNearest(embedding, threshold) {
        calls.push({ embedding, threshold });
        return Promise.resolve(null);
      },
      findNearestTopK() {
        return Promise.resolve([]);
      },
    };
    const categorizador = new EmbeddingsCategorizador(embeddingService, repo, 0.82);

    await categorizador.classify('test');

    expect(calls).toHaveLength(1);
    expect(calls[0].threshold).toBe(0.82);
  });
});
