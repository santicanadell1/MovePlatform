/**
 * Seed de datos para la demo del video.
 *
 * Crea idempotentemente:
 *   - 5 conductores: reutiliza conductor1..5@move.uy (sembrados por
 *     booking-service vía seed-privileged-users.ts) y los refleja en
 *     operations.users con el mismo firebaseUid
 *   - 3 categorías con pricingRules en operations y booking
 *   - 10 vehículos en operations (via HTTP)
 *   - 3 zonas en Montevideo: 1 RED + 2 PREFERRED (via HTTP)
 *   - 5 clientes: 3 EMPRESA + 2 PARTICULAR (via HTTP booking)
 *   - 3 productos de empresa (via HTTP booking)
 *   - 20 reservas en distintos estados (pg directo booking schema)
 *   - 4 traslados: 2 IN_TRANSIT + 2 COMPLETED (pg directo tracking schema)
 *
 * Variables de entorno (adicionales al .env de operations-service):
 *   FIREBASE_API_KEY     Web API key de Firebase (para custom token → ID token)
 *   BOOKING_SERVICE_URL  default: http://localhost:3001
 *   OPS_SERVICE_URL      default: http://localhost:3002
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import createCuid from 'cuid';
import * as admin from 'firebase-admin';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { PrismaClient } from '../src/generated/client';

// ── Config ────────────────────────────────────────────────────────────────────

const BOOKING_URL = process.env['BOOKING_SERVICE_URL'] ?? 'http://localhost:3001';
const OPS_URL = process.env['OPS_SERVICE_URL'] ?? 'http://localhost:3002';
const FIREBASE_API_KEY = process.env['FIREBASE_API_KEY'] ?? '';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] ?? '',
      privateKey: (process.env['FIREBASE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n'),
    }),
  });
}

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

/* eslint-disable no-console */

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function httpGet(
  baseUrl: string,
  urlPath: string,
  token: string,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as { data: unknown };
  return { status: res.status, data: json.data };
}

async function httpPost(
  baseUrl: string,
  urlPath: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data: unknown };
  return { status: res.status, data: json.data };
}

// ── Firebase helpers ──────────────────────────────────────────────────────────

async function getOrCreateFirebaseUser(
  email: string,
  password: string,
  name: string,
  role: string,
): Promise<string> {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(existing.uid, { role });
    return existing.uid;
  } catch {
    const created = await admin.auth().createUser({ email, password, displayName: name });
    await admin.auth().setCustomUserClaims(created.uid, { role });
    return created.uid;
  }
}

async function exchangeCustomToken(uid: string): Promise<string> {
  const customToken = await admin.auth().createCustomToken(uid, { role: 'ADMIN' });
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) {
    throw new Error('No se pudo obtener el ID token — verificar FIREBASE_API_KEY');
  }
  return data.idToken;
}

// ── Phase 1: Admin ────────────────────────────────────────────────────────────

async function ensureAdminToken(): Promise<string> {
  const uid = await getOrCreateFirebaseUser('admin@move.uy', 'Admin1234!', 'Admin MOVE', 'ADMIN');
  const token = await exchangeCustomToken(uid);
  console.log('  ✓ admin@move.uy token obtenido');
  return token;
}

// ── Phase 2: Conductores ──────────────────────────────────────────────────────

interface ConductorResult {
  id: string;
  firebaseUid: string;
  email: string;
}

// Reutiliza los conductores reales sembrados por booking-service
// (seed-privileged-users.ts) para que puedan hacer login en booking
// y se les pueda asignar un traslado real en el smoke test.
const CONDUCTOR_DEFS = [
  { email: 'conductor1@move.uy', name: 'Conductor Uno' },
  { email: 'conductor2@move.uy', name: 'Conductor Dos' },
  { email: 'conductor3@move.uy', name: 'Conductor Tres' },
  { email: 'conductor4@move.uy', name: 'Conductor Cuatro' },
  { email: 'conductor5@move.uy', name: 'Conductor Cinco' },
];
const CONDUCTOR_PASSWORD = 'Conductor1234!';

async function seedConductors(): Promise<ConductorResult[]> {
  console.log('\nConductores:');
  const results: ConductorResult[] = [];
  for (const def of CONDUCTOR_DEFS) {
    const uid = await getOrCreateFirebaseUser(def.email, CONDUCTOR_PASSWORD, def.name, 'CONDUCTOR');
    const user = await prisma.user.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, name: def.name, role: 'CONDUCTOR' },
      update: { name: def.name },
    });
    results.push({ id: user.id, firebaseUid: uid, email: def.email });
    console.log(`  ✓ ${def.email}`);
  }
  return results;
}

// ── Phase 3: Operador ─────────────────────────────────────────────────────────

async function seedOperator(): Promise<void> {
  console.log('\nOperador:');
  const uid = await getOrCreateFirebaseUser(
    'operador@move.uy',
    'Operador1234!',
    'Operador MOVE',
    'OPERATOR',
  );
  await prisma.user.upsert({
    where: { firebaseUid: uid },
    create: { firebaseUid: uid, name: 'Operador MOVE', role: 'OPERATOR' },
    update: { name: 'Operador MOVE' },
  });
  console.log('  ✓ operador@move.uy');
}

// ── Phase 4: Categorías ───────────────────────────────────────────────────────

interface CategoryResult {
  opsId: string;
  bookingId: string;
  nameEs: string;
}

const CATEGORY_DEFS = [
  {
    nameEs: 'Electrónica Demo',
    nameEn: 'Electronics Demo',
    description: 'Equipos electrónicos y dispositivos tecnológicos: laptop, tablet, smartphone',
    examples: ['laptop', 'tablet', 'smartphone', 'cámara'],
    requiresMonitoring: true,
    generatesAlerts: true,
    surchargePercent: 15,
    pricingRules: { baseRate: 500, perKm: 50, handlingFee: 200 },
  },
  {
    nameEs: 'Muebles Demo',
    nameEn: 'Furniture Demo',
    description: 'Muebles y artículos para el hogar: sillón, mesa, cama, escritorio',
    examples: ['sillón', 'mesa', 'cama', 'escritorio'],
    requiresMonitoring: false,
    generatesAlerts: false,
    surchargePercent: 10,
    pricingRules: { baseRate: 800, perKm: 40, handlingFee: 300 },
  },
  {
    nameEs: 'Documentos Demo',
    nameEn: 'Documents Demo',
    description: 'Documentos, expedientes y archivos: carpetas, contratos, planos',
    examples: ['carpeta', 'contrato', 'planos', 'expediente'],
    requiresMonitoring: false,
    generatesAlerts: false,
    surchargePercent: 0,
    pricingRules: { baseRate: 200, perKm: 20, handlingFee: 50 },
  },
];

async function seedCategories(adminToken: string): Promise<CategoryResult[]> {
  console.log('\nCategorías:');
  const results: CategoryResult[] = [];
  const client = await pool.connect();

  try {
    for (const def of CATEGORY_DEFS) {
      // Ops category via HTTP
      let opsId: string;
      const createRes = await httpPost(
        OPS_URL,
        '/api/operaciones/categorias',
        {
          nameEs: def.nameEs,
          nameEn: def.nameEn,
          description: def.description,
          examples: def.examples,
          requiresMonitoring: def.requiresMonitoring,
          generatesAlerts: def.generatesAlerts,
          surchargePercent: def.surchargePercent,
        },
        adminToken,
      );

      if (createRes.status === 201) {
        opsId = (createRes.data as { id: string }).id;
      } else if (createRes.status === 409) {
        const listRes = await httpGet(OPS_URL, '/api/operaciones/categorias', adminToken);
        const cats = listRes.data as Array<{ id: string; nameEs: string }>;
        const found = cats.find((c) => c.nameEs === def.nameEs);
        if (!found) throw new Error(`Categoría ${def.nameEs} no encontrada tras 409`);
        opsId = found.id;
      } else {
        throw new Error(`Error creando categoría ops (${String(createRes.status)}): ${def.nameEs}`);
      }

      // Ops pricing rule via pg (idempotente por category_id)
      await client.query(
        `INSERT INTO operations.pricing_rules (id, category_id, rules, created_at, updated_at)
         SELECT $1, $2, $3::jsonb, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM operations.pricing_rules WHERE category_id = $2)`,
        [createCuid(), opsId, JSON.stringify(def.pricingRules)],
      );

      // Booking category via pg
      await client.query(`SET search_path TO booking, public`);
      const catRow = await client.query<{ id: string }>(
        `INSERT INTO categories (id, name_es, name_en, description, examples, requires_monitoring,
           generates_alerts, surcharge_percent, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, NOW(), NOW())
         ON CONFLICT (name_es) DO UPDATE
           SET surcharge_percent = EXCLUDED.surcharge_percent, updated_at = NOW()
         RETURNING id`,
        [
          createCuid(),
          def.nameEs,
          def.nameEn,
          def.description,
          JSON.stringify(def.examples),
          def.requiresMonitoring,
          def.generatesAlerts,
          def.surchargePercent,
        ],
      );
      const bookingId = catRow.rows[0]!.id;

      // Booking pricing rule via pg (idempotente por category_id)
      await client.query(
        `INSERT INTO pricing_rules (id, category_id, rules, active, created_at, updated_at)
         SELECT $1, $2, $3::jsonb, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE category_id = $2)`,
        [createCuid(), bookingId, JSON.stringify(def.pricingRules)],
      );

      results.push({ opsId, bookingId, nameEs: def.nameEs });
      console.log(
        `  ✓ ${def.nameEs} (ops: ${opsId.slice(0, 8)}… booking: ${bookingId.slice(0, 8)}…)`,
      );
    }
  } finally {
    client.release();
  }

  // Activar reglas en memoria del booking-service
  await httpPost(BOOKING_URL, '/v1/admin/pricing/reload', {}, adminToken);
  console.log('  ✓ Pricing rules recargadas en booking-service');

  return results;
}

// ── Phase 4: Vehículos ────────────────────────────────────────────────────────

interface VehicleResult {
  id: string;
  plate: string;
}

const VEHICLE_DEFS = [
  { plate: 'DEMO-001', type: 'CAMION', capacity: 5000, gpsDeviceId: 'GPS-DEMO-001' },
  { plate: 'DEMO-002', type: 'CAMION', capacity: 3000, gpsDeviceId: 'GPS-DEMO-002' },
  { plate: 'DEMO-003', type: 'FURGONETA', capacity: 1500, gpsDeviceId: 'GPS-DEMO-003' },
  { plate: 'DEMO-004', type: 'FURGONETA', capacity: 1000, gpsDeviceId: 'GPS-DEMO-004' },
  { plate: 'DEMO-005', type: 'AUTO', capacity: 200, gpsDeviceId: 'GPS-DEMO-005' },
  { plate: 'DEMO-006', type: 'AUTO', capacity: 200, gpsDeviceId: 'GPS-DEMO-006' },
  { plate: 'DEMO-007', type: 'CAMIONETA', capacity: 2000, gpsDeviceId: 'GPS-DEMO-007' },
  { plate: 'DEMO-008', type: 'CAMIONETA', capacity: 2500, gpsDeviceId: 'GPS-DEMO-008' },
  { plate: 'DEMO-009', type: 'MOTO', capacity: 50, gpsDeviceId: 'GPS-DEMO-009' },
  { plate: 'DEMO-010', type: 'MOTO', capacity: 50, gpsDeviceId: 'GPS-DEMO-010' },
];

async function seedVehicles(adminToken: string): Promise<VehicleResult[]> {
  console.log('\nVehículos:');
  const results: VehicleResult[] = [];

  for (const def of VEHICLE_DEFS) {
    const res = await httpPost(OPS_URL, '/api/operaciones/vehiculos', def, adminToken);
    if (res.status === 201) {
      results.push({ id: (res.data as { id: string }).id, plate: def.plate });
    } else if (res.status === 409) {
      const existing = await prisma.vehicle.findUnique({ where: { plate: def.plate } });
      if (!existing) throw new Error(`Vehículo ${def.plate} no encontrado tras 409`);
      results.push({ id: existing.id, plate: def.plate });
    } else {
      throw new Error(`Error creando vehículo (${String(res.status)}): ${def.plate}`);
    }
  }

  console.log(`  ✓ ${VEHICLE_DEFS.length} vehículos (CAMION, FURGONETA, AUTO, CAMIONETA, MOTO)`);
  return results;
}

// ── Phase 5: Zonas ────────────────────────────────────────────────────────────

const ZONE_DEFS = [
  {
    name: 'Cerro',
    type: 'RED' as const,
    geom: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-56.235, -34.875],
          [-56.215, -34.875],
          [-56.215, -34.895],
          [-56.235, -34.895],
          [-56.235, -34.875],
        ],
      ],
    },
  },
  {
    name: 'Ciudad Vieja',
    type: 'PREFERRED' as const,
    geom: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-56.21, -34.898],
          [-56.19, -34.898],
          [-56.19, -34.908],
          [-56.21, -34.908],
          [-56.21, -34.898],
        ],
      ],
    },
  },
  {
    name: 'Pocitos',
    type: 'PREFERRED' as const,
    geom: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-56.165, -34.9],
          [-56.145, -34.9],
          [-56.145, -34.915],
          [-56.165, -34.915],
          [-56.165, -34.9],
        ],
      ],
    },
  },
];

async function seedZones(adminToken: string): Promise<void> {
  console.log('\nZonas:');
  const listRes = await httpGet(OPS_URL, '/api/zonas', adminToken);
  const existing = new Set(((listRes.data as Array<{ name: string }>) ?? []).map((z) => z.name));

  for (const def of ZONE_DEFS) {
    if (existing.has(def.name)) {
      console.log(`  ~ ${def.name} (ya existe)`);
      continue;
    }
    const res = await httpPost(OPS_URL, '/api/zonas', def, adminToken);
    if (res.status !== 201) {
      throw new Error(`Error creando zona (${String(res.status)}): ${def.name}`);
    }
    console.log(`  ✓ ${def.name} [${def.type}]`);
  }
}

// ── Phase 6: Clientes y productos ─────────────────────────────────────────────

interface ClientResult {
  email: string;
  password: string;
  type: 'EMPRESA' | 'PARTICULAR';
  token: string;
  dbId: string;
}

const CLIENT_PASSWORD = 'Demo1234!';

const CLIENT_DEFS: Array<{
  email: string;
  name: string;
  type: 'EMPRESA' | 'PARTICULAR';
  companyName?: string;
}> = [
  {
    email: 'demo-empresa1@move.uy',
    name: 'Demo Empresa SA',
    type: 'EMPRESA',
    companyName: 'Demo Empresa SA',
  },
  {
    email: 'demo-empresa2@move.uy',
    name: 'Logística Norte',
    type: 'EMPRESA',
    companyName: 'Logística Norte SRL',
  },
  {
    email: 'demo-empresa3@move.uy',
    name: 'Transportes Sur',
    type: 'EMPRESA',
    companyName: 'Transportes Sur SA',
  },
  { email: 'demo-particular1@move.uy', name: 'Demo Particular Uno', type: 'PARTICULAR' },
  { email: 'demo-particular2@move.uy', name: 'Demo Particular Dos', type: 'PARTICULAR' },
];

async function seedClients(categories: CategoryResult[]): Promise<ClientResult[]> {
  console.log('\nClientes:');
  const results: ClientResult[] = [];

  for (const def of CLIENT_DEFS) {
    const body: Record<string, unknown> = {
      type: def.type,
      name: def.name,
      email: def.email,
      password: CLIENT_PASSWORD,
    };
    if (def.companyName) body['companyName'] = def.companyName;

    const reg = await httpPost(BOOKING_URL, '/v1/auth/register', body);
    if (reg.status !== 201 && reg.status !== 409) {
      throw new Error(`Register falló para ${def.email}: HTTP ${String(reg.status)}`);
    }

    const login = await httpPost(BOOKING_URL, '/v1/auth/login', {
      email: def.email,
      password: CLIENT_PASSWORD,
    });
    if (login.status !== 200) throw new Error(`Login falló para ${def.email}`);
    const token = (login.data as { token: string }).token;

    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM booking.users WHERE email = $1`,
      [def.email],
    );
    if (!rows[0]) throw new Error(`Usuario no encontrado en booking DB: ${def.email}`);

    results.push({
      email: def.email,
      password: CLIENT_PASSWORD,
      type: def.type,
      token,
      dbId: rows[0].id,
    });
    console.log(`  ✓ ${def.email} [${def.type}]`);
  }

  // Productos para clientes EMPRESA
  console.log('\nProductos de empresa:');
  const empresas = results.filter((c) => c.type === 'EMPRESA');
  for (let i = 0; i < empresas.length; i++) {
    const client = empresas[i]!;
    const cat = categories[i % categories.length]!;
    const res = await httpPost(
      BOOKING_URL,
      '/v1/companies/products',
      { name: `Producto Demo ${String(i + 1)}`, categoryId: cat.bookingId },
      client.token,
    );
    if (res.status !== 201 && res.status !== 409) {
      throw new Error(`Error creando producto para ${client.email}: HTTP ${String(res.status)}`);
    }
    console.log(`  ✓ Producto Demo ${String(i + 1)} (${cat.nameEs}) → ${client.email}`);
  }

  return results;
}

// ── Phase 7: Reservas ─────────────────────────────────────────────────────────

const ORIGINS = [
  { address: 'Demo - Centro, Av. 18 de Julio 1234', lat: -34.9059, lng: -56.1912 },
  { address: 'Demo - Pocitos, Av. Brasil 2760', lat: -34.91, lng: -56.152 },
  { address: 'Demo - Malvín, Av. Italia 3400', lat: -34.89, lng: -56.13 },
  { address: 'Demo - Parque Batlle, Av. Ricaldoni 3102', lat: -34.8976, lng: -56.158 },
  { address: 'Demo - Buceo, Av. Saldanha da Gama 3200', lat: -34.904, lng: -56.14 },
];

const DESTINATIONS = [
  { address: 'Demo - Tres Cruces, Bulevar Artigas 1825', lat: -34.8987, lng: -56.172 },
  { address: 'Demo - Cerro, Av. Carlos María Ramírez 2201', lat: -34.887, lng: -56.224 },
  { address: 'Demo - Colón, Av. Burgues 2765', lat: -34.88, lng: -56.23 },
  { address: 'Demo - Punta Carretas, José Ellauri 220', lat: -34.9145, lng: -56.1685 },
  { address: 'Demo - Aguada, Paraguay 1370', lat: -34.897, lng: -56.186 },
];

async function seedReservations(
  clients: ClientResult[],
  vehicles: VehicleResult[],
  conductors: ConductorResult[],
): Promise<string[]> {
  console.log('\nReservas:');

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM booking.reservations WHERE origin LIKE 'Demo - %'`,
  );
  if (parseInt(countRows[0]?.count ?? '0', 10) >= 20) {
    console.log('  ~ Ya existen ≥20 reservas demo, omitiendo');
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM booking.reservations WHERE origin LIKE 'Demo - %' ORDER BY created_at LIMIT 8 OFFSET 12`,
    );
    return rows.map((r) => r.id);
  }

  const clientIds = clients.map((c) => c.dbId);
  const vehicleIds = vehicles.slice(0, 4).map((v) => v.id);
  const conductorIds = conductors.slice(0, 4).map((c) => c.firebaseUid);
  const ids: string[] = [];

  const dbClient = await pool.connect();
  try {
    await dbClient.query(`SET search_path TO booking, public`);

    const statuses = [
      ...Array(4).fill('PENDING_QUOTE'),
      ...Array(4).fill('QUOTED'),
      ...Array(4).fill('CONFIRMED'),
      ...Array(8).fill('ASSIGNED'),
    ];

    for (let i = 0; i < 20; i++) {
      const id = createCuid();
      const status = statuses[i]!;
      const origin = ORIGINS[i % ORIGINS.length]!;
      const dest = DESTINATIONS[(i + 2) % DESTINATIONS.length]!;
      const scheduledDate = new Date(Date.now() + ((i % 7) + 1) * 24 * 60 * 60 * 1000);
      const hasCost = ['QUOTED', 'CONFIRMED', 'ASSIGNED'].includes(status);
      const isAssigned = status === 'ASSIGNED';
      const vehicleId = isAssigned ? (vehicleIds[i % vehicleIds.length] ?? null) : null;
      const conductorId = isAssigned ? (conductorIds[i % conductorIds.length] ?? null) : null;
      const totalCost = hasCost ? 1000 + i * 150 : null;
      const clientId = clientIds[i % clientIds.length]!;

      await dbClient.query(
        `INSERT INTO reservations
           (id, client_id, origin, destination, origin_lat, origin_lng,
            destination_lat, destination_lng, scheduled_date, status,
            total_cost, vehicle_id, conductor_id, assigned_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 $11,$12,$13,$14,NOW(),NOW())`,
        [
          id,
          clientId,
          origin.address,
          dest.address,
          origin.lat,
          origin.lng,
          dest.lat,
          dest.lng,
          scheduledDate,
          status,
          totalCost,
          vehicleId,
          conductorId,
          isAssigned ? new Date() : null,
        ],
      );
      ids.push(id);
    }
  } finally {
    dbClient.release();
  }

  console.log('  ✓ 4 PENDING_QUOTE | 4 QUOTED | 4 CONFIRMED | 8 ASSIGNED');
  return ids;
}

// ── Phase 8: Traslados ────────────────────────────────────────────────────────

async function seedTransfers(
  reservationIds: string[],
  vehicles: VehicleResult[],
  conductors: ConductorResult[],
): Promise<void> {
  console.log('\nTraslados:');

  // Usar las últimas 4 reservas ASSIGNED
  const targetIds = reservationIds.slice(16);
  if (targetIds.length < 4) {
    console.log('  ~ Insuficientes reservas ASSIGNED para traslados');
    return;
  }

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tracking.transfers WHERE reservation_id = ANY($1)`,
    [targetIds],
  );
  if (parseInt(countRows[0]?.count ?? '0', 10) >= 4) {
    console.log('  ~ Ya existen traslados demo, omitiendo');
    return;
  }

  const now = new Date();
  const twoHrsAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fourHrsAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const defs = [
    {
      reservationId: targetIds[0]!,
      vehicleId: vehicles[0]!.id,
      conductorId: conductors[0]!.firebaseUid,
      status: 'IN_TRANSIT',
      startedAt: twoHrsAgo,
      finishedAt: null,
    },
    {
      reservationId: targetIds[1]!,
      vehicleId: vehicles[1]!.id,
      conductorId: conductors[1]!.firebaseUid,
      status: 'IN_TRANSIT',
      startedAt: twoHrsAgo,
      finishedAt: null,
    },
    {
      reservationId: targetIds[2]!,
      vehicleId: vehicles[2]!.id,
      conductorId: conductors[2]!.firebaseUid,
      status: 'COMPLETED',
      startedAt: fourHrsAgo,
      finishedAt: twoHrsAgo,
    },
    {
      reservationId: targetIds[3]!,
      vehicleId: vehicles[3]!.id,
      conductorId: conductors[3]!.firebaseUid,
      status: 'COMPLETED',
      startedAt: fourHrsAgo,
      finishedAt: twoHrsAgo,
    },
  ];

  const dbClient = await pool.connect();
  try {
    for (const t of defs) {
      const id = uuidv4();

      const { rows } = await dbClient.query<{ origin: string; destination: string }>(
        `SELECT origin, destination FROM booking.reservations WHERE id = $1`,
        [t.reservationId],
      );
      const res = rows[0];

      await dbClient.query(`SET search_path TO tracking, public`);
      await dbClient.query(
        `INSERT INTO transfers (id, reservation_id, vehicle_id, conductor_id, status, started_at, finished_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
         ON CONFLICT (reservation_id) DO NOTHING`,
        [id, t.reservationId, t.vehicleId, t.conductorId, t.status, t.startedAt, t.finishedAt],
      );

      if (res) {
        await dbClient.query(
          `INSERT INTO operations.transfers_projection
             (id, reservation_id, vehicle_id, conductor_id, status, origin, destination, started_at, finished_at, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            id,
            t.reservationId,
            t.vehicleId,
            t.conductorId,
            t.status,
            res.origin,
            res.destination,
            t.startedAt,
            t.finishedAt,
          ],
        );
      }

      console.log(`  ✓ [${t.status}] reserva ${t.reservationId.slice(0, 8)}…`);
    }
  } finally {
    dbClient.release();
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(clients: ClientResult[], conductors: ConductorResult[]): void {
  const W = 58;
  const line = '═'.repeat(W);
  const pad = (s: string) => s.padEnd(W - 2);

  console.log(`\n╔${line}╗`);
  console.log(`║ ${pad('MOVE DEMO SEED — CREDENCIALES')} ║`);
  console.log(`╠${line}╣`);
  console.log(`║ ${pad('ADMIN')} ║`);
  console.log(`║   ${pad('admin@move.uy  /  Admin1234!')} ║`);
  console.log(`╠${line}╣`);
  console.log(`║ ${pad('OPERADOR')} ║`);
  console.log(`║   ${pad('operador@move.uy  /  Operador1234!')} ║`);
  console.log(`╠${line}╣`);
  console.log(`║ ${pad('CONDUCTORES  (password: Conductor1234!)')} ║`);
  for (const c of conductors) {
    console.log(`║   ${pad(c.email)} ║`);
  }
  console.log(`╠${line}╣`);
  console.log(`║ ${pad('CLIENTES  (password: Demo1234!)')} ║`);
  for (const c of clients) {
    console.log(`║   [${c.type.padEnd(10)}] ${pad(c.email)} ║`);
  }
  console.log(`╚${line}╝`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('MOVE Demo Seed iniciando...\n');

  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY requerido — agregar al .env de operations-service');
  }

  const adminToken = await ensureAdminToken();
  const conductors = await seedConductors();
  await seedOperator();
  const categories = await seedCategories(adminToken);
  const vehicles = await seedVehicles(adminToken);
  await seedZones(adminToken);
  const clients = await seedClients(categories);
  const reservationIds = await seedReservations(clients, vehicles, conductors);
  await seedTransfers(reservationIds, vehicles, conductors);

  printSummary(clients, conductors);
  console.log('\nSeed completado.\n');
}

async function cleanup(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
  await admin.app().delete();
}

seed()
  .catch((err: unknown) => {
    console.error('\nError en seed:', err);
    process.exit(1);
  })
  .finally(() => void cleanup());
