import pg from 'pg';
const { Client } = pg;

async function embed(text) {
  const r = await fetch((process.env.OLLAMA_URL ?? 'http://ollama:11434') + '/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: `search_query: ${text}` }),
  });
  return (await r.json()).embedding;
}

const query = process.argv[2] ?? 'hilos agujas punto tejer';
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=booking,public',
});
await c.connect();

const e = await embed(query);
const v = '[' + e.join(',') + ']';
const { rows } = await c.query(
  `SELECT c.name_es, 1 - (ce.embedding <=> $1::vector) as similarity
   FROM booking.category_embeddings ce
   JOIN booking.categories c ON c.id = ce.category_id
   ORDER BY similarity DESC LIMIT 10`,
  [v],
);
console.log(`Query: "${query}"\n`);
for (const r of rows) console.log(`  ${parseFloat(r.similarity).toFixed(4)}  ${r.name_es}`);
await c.end();
