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

const OPERATOR_TOKEN = makeTestToken('op-uid-1', UserRole.OPERATOR, 'op@move.uy');

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function seedReservation(
  pool: Pool,
  opts: {
    id: string;
    status?: string;
    goodsSummary?: Array<{ size: string; quantity: number }>;
  },
): Promise<void> {
  const status = opts.status ?? 'CONFIRMED';
  const goods = JSON.stringify(opts.goodsSummary ?? []);
  await pool.query(
    `INSERT INTO operations.reservations_projection
       (id, scheduled_date, origin, destination, goods_summary, status)
     VALUES ($1, $2, 'Origen Test', 'Destino Test', $3, $4)`,
    [opts.id, FUTURE_DATE, goods, status],
  );
}

describe('Asignación de reserva HTTP — /api/operaciones/reservas/:id/asignar', () => {
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

  it('asigna reserva OK → 200 con vehicleId y conductorId', async () => {
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'conductor-uid-ok',
        name: 'Conductor Test',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        plate: 'TST001',
        type: 'VAN',
        capacity: 10,
        available: true,
      },
    });

    const reservationId = randomUUID();
    await seedReservation(pool, {
      id: reservationId,
      status: 'CONFIRMED',
      goodsSummary: [{ size: 'SMALL', quantity: 2 }],
    });

    const res = await request(app)
      .post(`/api/operaciones/reservas/${reservationId}/asignar`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.reservationId).toBe(reservationId);
    expect(res.body.data.vehicleId).toBe(vehicle.id);
    expect(res.body.data.conductorId).toBe(conductor.id);
  });

  it('retorna 422 cuando la capacidad del vehículo es insuficiente', async () => {
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'conductor-uid-cap',
        name: 'Conductor Cap',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        plate: 'CAP001',
        type: 'VAN',
        capacity: 1,
        available: true,
      },
    });

    const reservationId = randomUUID();
    await seedReservation(pool, {
      id: reservationId,
      status: 'CONFIRMED',
      goodsSummary: [{ size: 'LARGE', quantity: 2 }], // peso = 6 > 1
    });

    const res = await request(app)
      .post(`/api/operaciones/reservas/${reservationId}/asignar`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_CAPACITY');
  });

  it('retorna 409 al asignar el mismo vehículo ya ocupado (doble booking)', async () => {
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'conductor-uid-dbl',
        name: 'Conductor Doble',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        plate: 'DBL001',
        type: 'VAN',
        capacity: 10,
        available: true,
      },
    });

    const res1Id = randomUUID();
    await seedReservation(pool, { id: res1Id, status: 'CONFIRMED' });

    await request(app)
      .post(`/api/operaciones/reservas/${res1Id}/asignar`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    const res2Id = randomUUID();
    await seedReservation(pool, { id: res2Id, status: 'CONFIRMED' });

    const res = await request(app)
      .post(`/api/operaciones/reservas/${res2Id}/asignar`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VEHICLE_NOT_AVAILABLE');
  });

  it('retorna 404 cuando la reserva no existe', async () => {
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'conductor-uid-404',
        name: 'Conductor 404',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        plate: 'NOT001',
        type: 'VAN',
        capacity: 5,
        available: true,
      },
    });

    const res = await request(app)
      .post('/api/operaciones/reservas/id-que-no-existe/asignar')
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESERVATION_NOT_FOUND');
  });

  it('retorna 409 cuando la reserva no está en estado CONFIRMED', async () => {
    const conductor = await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: 'conductor-uid-stat',
        name: 'Conductor Stat',
        role: 'CONDUCTOR',
        status: 'ACTIVE',
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        plate: 'STAT01',
        type: 'VAN',
        capacity: 5,
        available: true,
      },
    });

    const reservationId = randomUUID();
    await seedReservation(pool, { id: reservationId, status: 'ASSIGNED' });

    const res = await request(app)
      .post(`/api/operaciones/reservas/${reservationId}/asignar`)
      .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send({ vehicleId: vehicle.id, conductorId: conductor.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_RESERVATION_STATUS');
  });
});
