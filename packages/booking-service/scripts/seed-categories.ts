/**
 * Seed de categorías desde el CSV provisto por la cátedra.
 * Uso: ts-node scripts/seed-categories.ts
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

/**
 * Limpia el campo descripción del CSV malformado de la cátedra.
 * El CSV envuelve la descripción en comillas dobles escapadas (`""..."`) y, en
 * algunas filas, parte la descripción con el artefacto `";"`. Esta función
 * recupera el texto plano completo.
 */
function cleanDescription(raw: string): string {
  return raw
    .replace(/""/g, '"') // comillas escapadas CSV → comilla simple
    .replace(/^"+|"+$/g, '') // comillas envolventes del campo
    .replace(/";"/g, ', ') // artefacto del CSV: ";" separa fragmentos de la descripción
    .replace(/"/g, '') // comillas residuales
    .replace(/\s+/g, ' ') // normalizar espacios
    .trim();
}

function parseLine(raw: string): { nameEn: string; nameEs: string; description: string } | null {
  let line = raw.trim();
  if (!line || line.startsWith('id,')) return null;

  // Cada fila viene envuelta en comillas y termina con ";" o ";;".
  if (line.startsWith('"')) line = line.slice(1);
  line = line.replace(/[";]+$/, '');

  // id, nameEn y nameEs no contienen comas → se separan por las 3 primeras comas.
  // La descripción es el resto (puede contener comas y el artefacto ";").
  const c1 = line.indexOf(',');
  const c2 = line.indexOf(',', c1 + 1);
  const c3 = line.indexOf(',', c2 + 1);
  if (c1 === -1 || c2 === -1 || c3 === -1) return null;

  return {
    nameEn: line.slice(c1 + 1, c2).trim(),
    nameEs: line.slice(c2 + 1, c3).trim(),
    description: cleanDescription(line.slice(c3 + 1)),
  };
}

function extractKeywords(nameEs: string, description: string): string[] {
  const stopwords = new Set([
    'de',
    'y',
    'en',
    'para',
    'con',
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'por',
    'del',
    'al',
    'se',
    'a',
    'o',
    'e',
    'que',
    'su',
    'sus',
    'es',
    'sin',
    'no',
    'ni',
    'si',
    'más',
    'muy',
    'como',
    'esto',
    'este',
    'esta',
  ]);

  const raw = `${nameEs} ${description}`.toLowerCase();
  const tokens = raw.split(/[\s,;:.()""'\-/]+/).filter((w) => w.length >= 4 && !stopwords.has(w));
  return [...new Set(tokens)].slice(0, 20);
}

async function main(): Promise<void> {
  const csvPath = join(__dirname, '../prisma/categories.csv');
  const lines = readFileSync(csvPath, 'utf-8').split('\n');

  let created = 0;
  let skipped = 0;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { nameEn, nameEs, description } = parsed;
    if (!nameEs || !nameEn) continue;

    const keywords = extractKeywords(nameEs, description);

    try {
      await prisma.category.upsert({
        where: { nameEs },
        create: {
          nameEs,
          nameEn,
          description,
          examples: keywords,
          requiresMonitoring: false,
          generatesAlerts: false,
          surchargePercent: 0,
          pricingRules: {
            create: {
              rules: { baseRate: 100, ratePerKm: 50, surchargePercent: 0 },
              active: true,
            },
          },
        },
        update: {},
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`Seed completado: ${created} categorías creadas, ${skipped} omitidas.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
