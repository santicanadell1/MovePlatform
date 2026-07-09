import type { Pool } from 'pg';

import type {
  ICategoryEmbeddingRepository,
  NearestCategoryResult,
} from '../../domain/ports/category-embedding.repository.port';

interface NearestRow {
  readonly category_id: string;
  readonly similarity: number;
}

export class PgCategoryEmbeddingRepository implements ICategoryEmbeddingRepository {
  constructor(private readonly pool: Pool) {}

  async findNearest(embedding: number[], threshold: number): Promise<NearestCategoryResult | null> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const { rows } = await this.pool.query<NearestRow>(
      `SELECT category_id, 1 - (embedding <=> $1::vector) AS similarity
       FROM booking.category_embeddings
       WHERE 1 - (embedding <=> $1::vector) >= $2
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [vectorLiteral, threshold],
    );

    const best = rows[0];
    if (!best) return null;
    return { categoryId: best.category_id, similarity: Number(best.similarity) };
  }

  async findNearestTopK(embedding: number[], limit: number): Promise<NearestCategoryResult[]> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    const { rows } = await this.pool.query<NearestRow>(
      `SELECT category_id, 1 - (embedding <=> $1::vector) AS similarity
       FROM booking.category_embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, limit],
    );

    return rows.map((r) => ({ categoryId: r.category_id, similarity: Number(r.similarity) }));
  }
}
