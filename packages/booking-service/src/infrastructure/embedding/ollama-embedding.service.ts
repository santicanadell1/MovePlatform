import type { IEmbeddingService } from '../../domain/ports/embedding.service.port';

export class OllamaEmbeddingService implements IEmbeddingService {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_URL ?? 'http://localhost:11434',
    model: string = 'nomic-embed-text',
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: `search_query: ${text}` }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }
}
