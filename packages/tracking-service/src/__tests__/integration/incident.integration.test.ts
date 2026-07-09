import { Pool } from 'pg';
import request from 'supertest';
import { UserRole, TransferStatus } from '@move/shared';
import type { Application } from 'express';

import { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDb } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const RESERVATION_ID = 'b1c2d3e4-0001-0001-0001-000000000001';
const CONDUCTOR_UID = 'conductor-uid-002';
const CONDUCTOR_TOKEN = makeTestToken(CONDUCTOR_UID, UserRole.CONDUCTOR, 'conductor2@test.uy');
const OPERATOR_TOKEN = makeTestToken('operator-uid', UserRole.OPERATOR, 'operator@test.uy');

describe('Incident endpoints — integración HTTP', () => {
  let app: Application;
  let prisma: PrismaClient;
  let pgPool: Pool;

  beforeAll(() => {
    ({ app, prisma, pgPool } = buildTestApp());
  });

  beforeEach(async () => {
    await cleanDb(prisma, pgPool);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pgPool.end();
  });

  async function seedActiveTransfer() {
    return prisma.transfer.create({
      data: {
        id: 'transfer-incident-test',
        reservationId: RESERVATION_ID,
        vehicleId: 'vehicle-incident-test',
        conductorId: CONDUCTOR_UID,
        status: TransferStatus.IN_TRANSIT,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  describe('POST /api/tracking/traslados/:reservationId/incidencias', () => {
    it('reporta una incidencia correctamente (happy path)', async () => {
      await seedActiveTransfer();

      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/incidencias`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ description: 'Llanta pinchada en av. 18 de julio' });

      expect(res.status).toBe(201);
      expect(res.body.incidentId).toBeDefined();
      expect(res.body.transferId).toBe('transfer-incident-test');
    });

    it('retorna 403 cuando el rol no es CONDUCTOR', async () => {
      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/incidencias`)
        .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
        .send({ description: 'prueba' });

      expect(res.status).toBe(403);
    });

    it('retorna 409 cuando el traslado ya está finalizado', async () => {
      await prisma.transfer.create({
        data: {
          id: 'transfer-completed-test',
          reservationId: RESERVATION_ID,
          vehicleId: 'vehicle-completed-test',
          conductorId: CONDUCTOR_UID,
          status: TransferStatus.COMPLETED,
          startedAt: new Date(),
          finishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/incidencias`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ description: 'prueba' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/tracking/traslados/:reservationId/incidencias', () => {
    it('retorna la lista de incidencias del traslado', async () => {
      await seedActiveTransfer();

      await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/incidencias`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ description: 'Primera incidencia' });

      const res = await request(app)
        .get(`/api/tracking/traslados/${RESERVATION_ID}/incidencias`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].description).toBe('Primera incidencia');
    });
  });
});
