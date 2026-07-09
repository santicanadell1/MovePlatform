export interface ClassificationResult {
  readonly categoryId: string;
  readonly confidence: number;
  readonly strategy: 'embeddings' | 'rule-based' | 'llm';
}

export interface ICategorizador {
  readonly strategy: ClassificationResult['strategy'];
  readonly isAsync: boolean;
  classify(description: string): Promise<ClassificationResult | null>;
}
