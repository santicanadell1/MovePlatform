/**
 * Genera los embeddings de las categorías MOVE y los guarda en
 * `booking.category_embeddings`. Corre automáticamente en el arranque del
 * booking-service (entrypoint.sh), tras el seed de categorías.
 *
 * Idempotente: hace UPSERT por category_id, así que re-ejecutarlo es seguro.
 * Espera a que Ollama responda antes de empezar.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://ollama:11434';
const MODEL = 'nomic-embed-text';

interface CategoryRow {
  id: string;
  name_es: string;
  description: string | null;
  examples: string[] | null;
}

async function waitForOllama(retries = 30, delayMs = 5000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/tags`);
      if (res.ok) return;
    } catch {
      // Ollama todavía no responde; reintentar.
    }
    console.log(`Esperando a Ollama... (${i + 1}/${retries})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('Ollama no respondió a tiempo');
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: `search_document: ${text}` }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

function buildText(cat: CategoryRow): string {
  const keywords = Array.isArray(cat.examples) ? cat.examples : [];
  const keywordStr = keywords.join(', ');
  const description =
    cat.description?.trim() ||
    `Categoría para ${cat.name_es.toLowerCase()}, incluyendo artículos como: ${keywordStr}`;
  return `${cat.name_es}. ${description}. Artículos y productos relacionados: ${keywordStr}. ${cat.name_es}.`;
}

async function main(): Promise<void> {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL requerida');
    process.exit(1);
  }

  await waitForOllama();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows: categories } = await client.query<CategoryRow>(
    'SELECT id, name_es, description, examples FROM booking.categories',
  );
  console.log(`Generando embeddings para ${categories.length} categorías...`);

  let ok = 0;
  let skip = 0;

  for (const cat of categories) {
    try {
      const embedding = await embed(buildText(cat));
      const vector = `[${embedding.join(',')}]`;

      const { rows: existing } = await client.query<{ id: string }>(
        'SELECT id FROM booking.category_embeddings WHERE category_id = $1',
        [cat.id],
      );

      if (existing.length > 0) {
        await client.query(
          'UPDATE booking.category_embeddings SET embedding = $1::vector WHERE category_id = $2',
          [vector, cat.id],
        );
      } else {
        await client.query(
          'INSERT INTO booking.category_embeddings (id, category_id, embedding) VALUES ($1, $2, $3::vector)',
          [randomUUID(), cat.id, vector],
        );
      }
      ok++;
      if (ok % 40 === 0) console.log(`  ${ok}/${categories.length}...`);
    } catch (e) {
      console.error(`  Error en ${cat.name_es}: ${e instanceof Error ? e.message : String(e)}`);
      skip++;
    }
  }

  await client.end();
  console.log(`Listo: ${ok} embeddings generados, ${skip} errores.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
