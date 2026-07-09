import { Pool } from 'pg';
import request from 'supertest';
import { UserRole } from '@move/shared';
import type { Application } from 'express';

import { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDb } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const CONDUCTOR_TOKEN = makeTestToken('conductor-uid', UserRole.CONDUCTOR, 'conductor@test.uy');

function validGpsPayload(deviceId = 'device-gps-test') {
  return {
    deviceId,
    lat: -34.9,
    lng: -56.1,
    speed: 50,
    heading: 90,
    accuracy: 5,
    timestamp: new Date().toISOString(),
  };
}

describe('GPS endpoint — integración HTTP', () => {
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

  describe('POST /api/tracking/gps', () => {
    it('encola el punto GPS válido y responde 202 (happy path)', async () => {
      const res = await request(app)
        .post('/api/tracking/gps')
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send(validGpsPayload());

      expect(res.status).toBe(202);
      expect(res.body.message).toBe('GPS point enqueued');
    });

    it('retorna 400 con coordenadas inválidas', async () => {
      const res = await request(app)
        .post('/api/tracking/gps')
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ ...validGpsPayload(), lat: 200 });

      expect(res.status).toBe(400);
      expect(res.body.error.fieldErrors.lat).toBeDefined();
    });

    it('retorna 401 sin JWT', async () => {
      const res = await request(app)
        .post('/api/tracking/gps')
        .send(validGpsPayload());

      expect(res.status).toBe(401);
    });
  });
});
