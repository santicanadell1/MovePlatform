export interface NearestCategoryResult {
  readonly categoryId: string;
  readonly similarity: number;
}

export interface ICategoryEmbeddingRepository {
  findNearest(embedding: number[], threshold: number): Promise<NearestCategoryResult | null>;
  findNearestTopK(embedding: number[], limit: number): Promise<NearestCategoryResult[]>;
}
