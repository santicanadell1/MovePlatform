import * as fs from 'node:fs';
import * as path from 'node:path';

import Redis from 'ioredis';

import { PrismaClient } from '../src/generated/client';

/**
 * Seed de datos para tests de carga K6.
 * Crea 20 usuarios CLIENT_EMPRESA "top" y 1 "cold" via HTTP register,
 * crea CompanyProducts via HTTP, siembra reservas históricas vía Prisma
 * y warmea el cache Redis top-20.
 *
 * No requiere Firebase Admin SDK: usa el endpoint público POST /v1/auth/register.
 *
 * Req: DATABASE_URL, REDIS_URL
 *      K6_BOOKING_URL (default: http://localhost:3001)
 * Output: tests/k6/setup/k6-credentials.json
 *
 * Flags:
 *   --clean   Eliminar todos los usuarios k6-* antes de crear nuevos
 */

const BOOKING_URL = process.env['K6_BOOKING_URL'] ?? 'http://localhost:3001';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const TOP_CLIENTS_KEY = 'top20:clients';
const PRODUCTS_KEY = (clientId: string) => `products:${clientId}`;
const TTL_SECONDS = 604800; // 7 días

const TOP_PASSWORD = 'K6TopPass123!';
const COLD_PASSWORD = 'K6ColdPass123!';
const TOP_COUNT = 20;

/* eslint-disable no-console */

const prisma = new PrismaClient();
const redis = new Redis(REDIS_URL);

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function httpPost(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BOOKING_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: unknown; error: unknown };
  return { status: res.status, data: json.data };
}

async function httpPostAuth(
  path: string,
  body: unknown,
  token: string,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BOOKING_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: unknown; error: unknown };
  return { status: res.status, data: json.data };
}

// ── User helpers ────────────────────────────────────────────────────────────

async function registerAndLogin(
  email: string,
  password: string,
  name: string,
): Promise<{ token: string; userId: string }> {
  // Intentar registrar (idempotente: si ya existe, solo loguear)
  const reg = await httpPost('/v1/auth/register', {
    type: 'EMPRESA',
    name,
    email,
    password,
    companyName: `${name} SA`,
  });

  if (reg.status !== 201 && reg.status !== 409) {
    throw new Error(`Register failed for ${email}: HTTP ${String(reg.status)}`);
  }

  const login = await httpPost('/v1/auth/login', { email, password });
  if (login.status !== 200) {
    throw new Error(`Login failed for ${email}: HTTP ${String(login.status)}`);
  }

  const loginData = login.data as { token: string; uid: string };

  // Obtener el userId de la BD (necesario para Prisma + Redis)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found in DB after register: ${email}`);

  return { token: loginData.token, userId: user.id };
}

async function ensureCompanyProduct(token: string, userId: string): Promise<string> {
  // Verificar si ya tiene un producto
  const existing = await prisma.companyProduct.findFirst({
    where: { clientId: userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Obtener la primera categoría disponible
  const cat = await prisma.category.findFirst({ select: { id: true } });
  if (!cat) throw new Error('No hay categorías. Ejecutar seed-categories.ts primero.');

  const res = await httpPostAuth(
    '/v1/companies/products',
    { name: 'Producto K6', categoryId: cat.id },
    token,
  );
  if (res.status !== 201) {
    throw new Error(`CompanyProduct creation failed: HTTP ${String(res.status)}`);
  }

  const product = res.data as { id: string };
  return product.id;
}

async function seedHistoricalReservations(userId: string): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await prisma.reservation.count({
    where: { clientId: userId, createdAt: { gte: since } },
  });

  if (existing >= 10) return;

  const toCreate = 10 - existing;
  for (let i = 0; i < toCreate; i++) {
    const daysAgo = Math.floor(Math.random() * 6) + 1;
    const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    await prisma.reservation.create({
      data: {
        clientId: userId,
        origin: 'Origen K6',
        destination: 'Destino K6',
        originLat: -34.82,
        originLng: -56.02,
        destinationLat: -34.9,
        destinationLng: -56.16,
        scheduledDate: past,
        status: 'CONFIRMED',
        totalCost: 5000,
        createdAt: past,
      },
    });
  }
}

async function warmRedisCache(
  topClients: Array<{ userId: string; productId: string }>,
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(TOP_CLIENTS_KEY);

  const clientIds = topClients.map((c) => c.userId);
  pipeline.sadd(TOP_CLIENTS_KEY, ...clientIds);
  pipeline.expire(TOP_CLIENTS_KEY, TTL_SECONDS);

  for (const { userId, productId } of topClients) {
    const product = await prisma.companyProduct.findUnique({ where: { id: productId } });
    if (!product) continue;
    const payload = JSON.stringify([
      {
        id: product.id,
        clientId: product.clientId,
        name: product.name,
        categoryId: product.categoryId,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      },
    ]);
    pipeline.set(PRODUCTS_KEY(userId), payload, 'EX', TTL_SECONDS);
  }

  await pipeline.exec();
  console.log(`  Redis: ${clientIds.length} top clients cacheados`);
}

async function cleanK6Users(): Promise<void> {
  console.log('Limpiando usuarios k6-*...');
  await prisma.user.deleteMany({ where: { email: { startsWith: 'k6-' } } });
  await redis.del(TOP_CLIENTS_KEY);
  console.log('Limpieza completada.');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const doClean = process.argv.includes('--clean');
  if (doClean) await cleanK6Users();

  console.log(`Creando ${String(TOP_COUNT)} usuarios top + 1 cold en ${BOOKING_URL}...`);

  const topClients: Array<{ userId: string; productId: string; email: string }> = [];

  for (let i = 1; i <= TOP_COUNT; i++) {
    const email = `k6-top-${String(i)}@test.move.uy`;
    const { token, userId } = await registerAndLogin(email, TOP_PASSWORD, `K6 Top ${String(i)}`);
    const productId = await ensureCompanyProduct(token, userId);
    topClients.push({ userId, productId, email });
    await seedHistoricalReservations(userId);
    process.stdout.write(`  top-${String(i)} ok\r`);
  }

  console.log(`\n${String(TOP_COUNT)} top users creados con reservas históricas.`);

  const coldEmail = 'k6-cold@test.move.uy';
  const { token: coldToken, userId: coldUserId } = await registerAndLogin(
    coldEmail,
    COLD_PASSWORD,
    'K6 Cold',
  );
  const coldProductId = await ensureCompanyProduct(coldToken, coldUserId);
  console.log('  cold user creado.');

  await warmRedisCache(topClients);

  const credentials = {
    topUser: { email: topClients[0]!.email, password: TOP_PASSWORD },
    coldUser: { email: coldEmail, password: COLD_PASSWORD },
    topProductId: topClients[0]!.productId,
    coldProductId,
  };

  const outPath = path.resolve(__dirname, '../../../tests/k6/setup/k6-credentials.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(credentials, null, 2));
  console.log(`\nCredenciales guardadas en: ${outPath}`);
  console.log('Seed K6 completado.');
}

async function cleanup(): Promise<void> {
  await prisma.$disconnect();
  await redis.quit();
}

seed()
  .catch((err: unknown) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => void cleanup());
