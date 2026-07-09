import { OllamaLLMCategorizador } from '../ollama-llm.categorizador';

const categories = [
  { id: 'cat-1', name: 'Electrónica', examples: ['televisor', 'heladera', 'notebook'] },
  { id: 'cat-2', name: 'Muebles', examples: ['sofá', 'mesa', 'silla'] },
];

function mockFetch(response: unknown, ok = true): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(response),
  }) as typeof fetch;
}

describe('OllamaLLMCategorizador', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna clasificación cuando Ollama responde con JSON válido', async () => {
    mockFetch({ response: '{"categoryId":"cat-1","confidence":0.9}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'qwen2.5:3b');

    const result = await cat.classify('televisor samsung 55 pulgadas', categories);

    expect(result).toEqual({ categoryId: 'cat-1', categoryName: 'Electrónica', confidence: 0.9 });
  });

  it('retorna null cuando el LLM alucina un categoryId inexistente', async () => {
    mockFetch({ response: '{"categoryId":"cat-999","confidence":0.9}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'qwen2.5:3b');

    const result = await cat.classify('algo raro', categories);

    expect(result).toBeNull();
  });

  it('envía el JSON schema (format) y los ejemplos de cada categoría en el prompt', async () => {
    mockFetch({ response: '{"categoryId":"cat-1","confidence":0.8}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'qwen2.5:3b');

    await cat.classify('televisor', categories);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1]?.body as string) as { format: unknown; prompt: string };
    expect(body.format).toBeDefined();
    expect(body.prompt).toContain('televisor');
  });

  it('retorna null cuando Ollama responde con categoryId null', async () => {
    mockFetch({ response: '{"categoryId":null}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    const result = await cat.classify('descripción ambigua', categories);

    expect(result).toBeNull();
  });

  it('retorna null cuando Ollama responde con HTTP error', async () => {
    mockFetch({}, false);
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    const result = await cat.classify('test', categories);

    expect(result).toBeNull();
  });

  it('retorna null cuando la respuesta de Ollama no es JSON válido', async () => {
    mockFetch({ response: 'texto libre sin estructura JSON' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    const result = await cat.classify('test', categories);

    expect(result).toBeNull();
  });

  it('incluye el modelo y la descripción en el prompt enviado a Ollama', async () => {
    mockFetch({ response: '{"categoryId":"cat-1","categoryName":"Electrónica","confidence":0.8}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    await cat.classify('heladera con freezer', categories);

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1]?.body as string) as { model: string; prompt: string };
    expect(body.model).toBe('llama3');
    expect(body.prompt).toContain('heladera con freezer');
  });

  it('omite ejemplos en el prompt cuando la categoría no tiene examples', async () => {
    const categoriesWithoutExamples = [
      { id: 'cat-1', name: 'Electrónica' },
      { id: 'cat-2', name: 'Muebles' },
    ];
    mockFetch({ response: '{"categoryId":"cat-1","confidence":0.7}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    const result = await cat.classify('televisor', categoriesWithoutExamples);

    expect(result).toEqual({ categoryId: 'cat-1', categoryName: 'Electrónica', confidence: 0.7 });
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchCall[1]?.body as string) as { prompt: string };
    expect(body.prompt).not.toContain('ej.:');
  });

  it('usa confidence=1 como fallback cuando Ollama no devuelve confidence', async () => {
    mockFetch({ response: '{"categoryId":"cat-2"}' });
    const cat = new OllamaLLMCategorizador('http://localhost:11434', 'llama3');

    const result = await cat.classify('sofá de tres cuerpos', categories);

    expect(result).toEqual({ categoryId: 'cat-2', categoryName: 'Muebles', confidence: 1 });
  });
});
