import { randomUUID } from 'node:crypto';

import request from 'supertest';
import type { Application } from 'express';
import { UserRole } from '@move/shared';

import type { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDatabase } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const BASE_RESERVATION = {
  origin: 'Av. 18 de Julio 1234, Montevideo',
  destination: 'Av. Italia 4567, Montevideo',
  originLat: -34.9011,
  originLng: -56.1645,
  destinationLat: -34.9111,
  destinationLng: -56.1745,
  scheduledDate: FUTURE_DATE,
};

describe('Reservas HTTP — /v1/reservas', () => {
  let app: Application;
  let prisma: PrismaClient;
  let particularToken: string;
  let operatorToken: string;

  const OPERATOR_FIREBASE_UID = 'op-firebase-uid-test';

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
    prisma = result.prisma;

    // Limpiar por si quedó basura de una ejecución previa
    await cleanDatabase(prisma);

    // Registrar usuario particular y obtener token via login
    await request(app).post('/v1/auth/register').send({
      type: 'PARTICULAR',
      name: 'Particular',
      email: 'particular@move.uy',
      password: 'pass12345',
    });
    const loginRes = await request(app).post('/v1/auth/login').send({
      email: 'particular@move.uy',
      password: 'pass12345',
    });
    particularToken = loginRes.body.data.token as string;

    // Sembrar usuario OPERATOR directamente en DB
    await prisma.user.create({
      data: {
        id: randomUUID(),
        firebaseUid: OPERATOR_FIREBASE_UID,
        email: 'op@move.uy',
        name: 'Operator',
        role: 'OPERATOR',
        type: 'PARTICULAR',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    operatorToken = makeTestToken(OPERATOR_FIREBASE_UID, UserRole.OPERATOR, 'op@move.uy');
  });

  beforeEach(async () => {
    // Solo limpiar reservas, mantener los usuarios del beforeAll
    await prisma.payment.deleteMany();
    await prisma.good.deleteMany();
    await prisma.reservation.deleteMany();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  // ── POST /v1/reservas — cliente particular ──────────────────────────

  describe('POST /v1/reservas — cliente particular', () => {
    it('returns 201 with reservation data', async () => {
      const res = await request(app)
        .post('/v1/reservas')
        .set('Authorization', `Bearer ${particularToken}`)
        .send({
          ...BASE_RESERVATION,
          goods: [{ description: 'Caja de libros', size: 'SMALL', quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toMatchObject({
        origin: BASE_RESERVATION.origin,
        destination: BASE_RESERVATION.destination,
        originLat: BASE_RESERVATION.originLat,
        originLng: BASE_RESERVATION.originLng,
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/v1/reservas')
        .send({ ...BASE_RESERVATION, goods: [{ description: 'Caja', quantity: 1 }] });

      expect(res.status).toBe(401);
    });

    it('returns 403 when operator tries to create reservation', async () => {
      const res = await request(app)
        .post('/v1/reservas')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ ...BASE_RESERVATION, goods: [{ description: 'Caja', quantity: 1 }] });

      expect(res.status).toBe(403);
    });

    it('returns 400 on empty goods array', async () => {
      const res = await request(app)
        .post('/v1/reservas')
        .set('Authorization', `Bearer ${particularToken}`)
        .send({ ...BASE_RESERVATION, goods: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on past scheduled date', async () => {
      const res = await request(app)
        .post('/v1/reservas')
        .set('Authorization', `Bearer ${particularToken}`)
        .send({
          ...BASE_RESERVATION,
          scheduledDate: new Date(Date.now() - 1000).toISOString(),
          goods: [{ description: 'Caja', quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /v1/reservas ─────────────────────────────────────────────────

  describe('GET /v1/reservas', () => {
    beforeEach(async () => {
      // Crear 2 reservas para el cliente particular
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/v1/reservas')
          .set('Authorization', `Bearer ${particularToken}`)
          .send({ ...BASE_RESERVATION, goods: [{ description: `Caja ${i + 1}`, quantity: 1 }] });
      }
    });

    it('returns 200 with own reservations for CLIENT_PARTICULAR', async () => {
      const res = await request(app)
        .get('/v1/reservas')
        .set('Authorization', `Bearer ${particularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.reservations).toHaveLength(2);
    });

    it('returns 200 with all reservations for OPERATOR', async () => {
      const res = await request(app)
        .get('/v1/reservas')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reservations.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/v1/reservas');
      expect(res.status).toBe(401);
    });

    it('filters by status=PENDING_CLASSIFICATION', async () => {
      const res = await request(app)
        .get('/v1/reservas?status=PENDING_CLASSIFICATION')
        .set('Authorization', `Bearer ${particularToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.reservations.every(
          (r: { status: string }) => r.status === 'PENDING_CLASSIFICATION',
        ),
      ).toBe(true);
    });

    it('paginates with limit and returns nextCursor when there are more results', async () => {
      const res = await request(app)
        .get('/v1/reservas?limit=1')
        .set('Authorization', `Bearer ${particularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reservations).toHaveLength(1);
      expect(res.body.data.nextCursor).not.toBeNull();
    });
  });
});
