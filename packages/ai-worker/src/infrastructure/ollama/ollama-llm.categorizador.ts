interface CategoryOption {
  id: string;
  name: string;
  examples?: string[];
}

export interface LlmClassificationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
}

/**
 * JSON Schema que Ollama usa para forzar una respuesta estructurada válida.
 * Evita los errores de parseo de respuestas en texto libre.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    categoryId: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
  required: ['categoryId', 'confidence'],
} as const;

export class OllamaLLMCategorizador {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async classify(
    description: string,
    categories: CategoryOption[],
  ): Promise<LlmClassificationResult | null> {
    // Incluimos los ejemplos de cada categoría para desambiguar categorías
    // de nombre parecido (ej. "Videojuegos" vs "Consolas de Videojuegos").
    const categoryList = categories
      .map((c) => {
        const ex = c.examples?.length ? ` (ej.: ${c.examples.slice(0, 6).join(', ')})` : '';
        return `${c.id}: ${c.name}${ex}`;
      })
      .join('\n');

    const prompt =
      `Sos un clasificador de productos para la plataforma de traslados MOVE.\n` +
      `Clasificá el bien "${description}" en UNA de estas categorías:\n${categoryList}\n\n` +
      `Elegí el categoryId más apropiado. Si ninguna aplica, devolvé categoryId null. ` +
      `confidence es tu certeza entre 0 y 1.`;

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: RESPONSE_SCHEMA,
          options: { temperature: 0 },
        }),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { response: string };
      const parsed = JSON.parse(data.response) as {
        categoryId: string | null;
        confidence?: number;
      };

      if (!parsed.categoryId) return null;
      const match = categories.find((c) => c.id === parsed.categoryId);
      if (!match) return null;

      return {
        categoryId: match.id,
        categoryName: match.name,
        confidence: parsed.confidence ?? 1,
      };
    } catch {
      return null;
    }
  }
}
