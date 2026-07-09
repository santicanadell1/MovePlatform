import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import request from 'supertest';
import type { Application } from 'express';
import { UserRole } from '@move/shared';
import type { Pool } from 'pg';

import type { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDatabase } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const OPERATOR_TOKEN = makeTestToken('op-uid-2', UserRole.OPERATOR, 'op2@move.uy');

async function seedTransfer(
  pool: Pool,
  opts: {
    id: string;
    reservationId: string;
    vehicleId: string;
    conductorId: string;
    status?: string;
  },
): Promise<void> {
  const status = opts.status ?? 'IN_TRANSIT';
  await pool.query(
    `INSERT INTO operations.transfers_projection
       (id, reservation_id, vehicle_id, conductor_id, status, origin, destination, created_at)
     VALUES ($1, $2, $3, $4, $5, 'Origen', 'Destino', NOW())`,
    [opts.id, opts.reservationId, opts.vehicleId, opts.conductorId, status],
  );
}

async function seedAlert(
  pool: Pool,
  opts: { id: string; transferId: string; type?: string; message?: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO operations.alerts_projection (id, transfer_id, type, lat, lng, message, created_at)
     VALUES ($1, $2, $3, -34.9, -56.1, $4, NOW())`,
    [opts.id, opts.transferId, opts.type ?? 'GEOFENCE', opts.message ?? 'Alerta test'],
  );
}

describe('Traslados HTTP — /api/operaciones/traslados', () => {
  let app: Application;
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
    prisma = result.prisma;
    pool = result.pool;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma, pool);
  });

  it('lista traslados sin filtros → 200 con items y nextCursor null', async () => {
    const vehicle = await prisma.vehicle.create({
      data: { id: randomUUID(), plate: 'TRF001', type: 'VAN', capacity: 5, available: false },
    });
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'cond-trf-1',
        name: 'Conductor TRF',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    await seedTransfer(pool, {
      id: randomUUID(),
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'IN_TRANSIT',
    });

    const res = await request(app)
      .get('/api/operaciones/traslados')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.nextCursor).toBeNull();
    expect(res.body.data.items[0].vehicle.plate).toBe('TRF001');
    expect(res.body.data.items[0].conductor.name).toBe('Conductor TRF');
    expect(res.body.data.items[0].activeAlerts).toEqual([]);
  });

  it('filtra por status=IN_TRANSIT → solo traslados activos', async () => {
    const vehicle = await prisma.vehicle.create({
      data: { id: randomUUID(), plate: 'TRF002', type: 'VAN', capacity: 5, available: false },
    });
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'cond-trf-2',
        name: 'Conductor TRF2',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    await seedTransfer(pool, {
      id: randomUUID(),
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'IN_TRANSIT',
    });

    await seedTransfer(pool, {
      id: randomUUID(),
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'COMPLETED',
    });

    const res = await request(app)
      .get('/api/operaciones/traslados?status=IN_TRANSIT')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('IN_TRANSIT');
  });

  it('filtra por hasAlerts=true → solo traslados con alertas', async () => {
    const vehicle = await prisma.vehicle.create({
      data: { id: randomUUID(), plate: 'TRF003', type: 'VAN', capacity: 5, available: false },
    });
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'cond-trf-3',
        name: 'Conductor TRF3',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const transferWithAlert = randomUUID();
    await seedTransfer(pool, {
      id: transferWithAlert,
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'IN_TRANSIT',
    });
    await seedAlert(pool, { id: randomUUID(), transferId: transferWithAlert });

    await seedTransfer(pool, {
      id: randomUUID(),
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'IN_TRANSIT',
    });

    const res = await request(app)
      .get('/api/operaciones/traslados?hasAlerts=true')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].activeAlerts).toHaveLength(1);
    expect(res.body.data.items[0].activeAlerts[0].type).toBe('GEOFENCE');
  });

  it('pagina resultados con nextCursor cuando hay más items que el límite', async () => {
    const vehicle = await prisma.vehicle.create({
      data: { id: randomUUID(), plate: 'TRF004', type: 'VAN', capacity: 5, available: false },
    });
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'cond-trf-4',
        name: 'Conductor TRF4',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    for (let i = 0; i < 3; i++) {
      await seedTransfer(pool, {
        id: randomUUID(),
        reservationId: randomUUID(),
        vehicleId: vehicle.id,
        conductorId: conductor.firebaseUid,
        status: 'IN_TRANSIT',
      });
    }

    const res = await request(app)
      .get('/api/operaciones/traslados?limit=2')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.nextCursor).not.toBeNull();

    const res2 = await request(app)
      .get(`/api/operaciones/traslados?limit=2&cursor=${res.body.data.nextCursor as string}`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.items).toHaveLength(1);
    expect(res2.body.data.nextCursor).toBeNull();
  });

  it('retorna 401 sin token de auth', async () => {
    const res = await request(app).get('/api/operaciones/traslados');
    expect(res.status).toBe(401);
  });

  it('retorna traslados cuando conductor_id es el firebase_uid del conductor', async () => {
    const vehicle = await prisma.vehicle.create({
      data: { id: randomUUID(), plate: 'TRF005', type: 'VAN', capacity: 5, available: false },
    });
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'firebase-uid-conductor-5',
        name: 'Conductor TRF5',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    // conductor_id almacena el firebase UID, no el CUID interno
    await seedTransfer(pool, {
      id: randomUUID(),
      reservationId: randomUUID(),
      vehicleId: vehicle.id,
      conductorId: conductor.firebaseUid,
      status: 'IN_TRANSIT',
    });

    const res = await request(app)
      .get('/api/operaciones/traslados')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].conductor.name).toBe('Conductor TRF5');
  });
});
