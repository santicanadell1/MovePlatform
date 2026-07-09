import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();
const CSV_PATH = path.resolve(__dirname, '../../..', 'product-categories(in).csv');
const MAX_EXAMPLES = 15;

function extractExamples(description: string): string[] {
  const colonIdx = description.indexOf(':');
  if (colonIdx === -1) return [];

  return description
    .substring(colonIdx + 1)
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, MAX_EXAMPLES);
}

/**
 * The CSV has a non-standard format where each data row is wrapped in outer
 * double-quotes and descriptions with multiple sub-parts use ";" as a separator.
 * This function normalises each line into valid RFC 4180 CSV.
 */
function preprocessCsv(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const processed: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // 1. Strip outer wrapping quote at start
    if (line.startsWith('"')) line = line.slice(1);

    // 2. Strip trailing closing quote + optional semicolons (e.g. """; or """;;)
    //    This always leaves "" at the end which is the description field's closing.
    line = line.replace(/"[;]*$/, '');

    // 3. Normalise multi-part description separators into plain semicolons.
    //    Patterns observed: ";" (row 1 style) and ;" or "; (row 10 style).
    line = line.replace(/";"?/g, '; ');
    line = line.replace(/;"/g, '; ');

    // 4. Convert double-double-quotes to single: ""field"" -> "field" (standard CSV)
    line = line.replace(/""/g, '"');

    if (line) processed.push(line);
  }

  return processed.join('\n');
}

async function seed(): Promise<void> {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV no encontrado: ${CSV_PATH}`);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const csvContent = preprocessCsv(raw);

  const records = parse(csvContent, {
    columns: false,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];

  const total = records.length;
  let upserted = 0;
  let skipped = 0;

  console.log(`Iniciando seed: ${total} categorías encontradas en CSV\n`);

  for (const row of records) {
    const [, nameEnRaw, nameEsRaw, ...descParts] = row;

    const nameEn = nameEnRaw?.replace(/^"+|"+$/g, '').trim() ?? '';
    const nameEs = nameEsRaw?.replace(/^"+|"+$/g, '').trim() ?? '';
    const description = descParts.join(',').replace(/^"+|"+$/g, '').trim();

    if (!nameEn || !nameEs || !description) {
      skipped++;
      continue;
    }

    const examples = extractExamples(description);

    await prisma.category.upsert({
      where: { nameEs },
      create: { nameEn, nameEs, description, examples },
      update: { nameEn, description, examples },
    });

    upserted++;
    process.stdout.write(`\r✓ [${upserted}/${total}] ${nameEs.substring(0, 60).padEnd(60)}`);
  }

  console.log(`\n\nSeed completado:`);
  console.log(`  ✓ ${upserted} categorías insertadas/actualizadas`);
  if (skipped > 0) console.log(`  ⚠ ${skipped} filas omitidas por datos incompletos`);
}

seed()
  .catch((err: unknown) => {
    console.error('\nError en seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
