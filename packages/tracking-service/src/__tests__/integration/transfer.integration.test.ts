import { Pool } from 'pg';
import request from 'supertest';
import { UserRole } from '@move/shared';
import type { Application } from 'express';

import { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDb, seedVehicle } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const RESERVATION_ID = 'a1b2c3d4-0001-0001-0001-000000000001';
const VEHICLE_ID = 'test-vehicle-001';
const DEVICE_ID = 'test-device-001';
const CONDUCTOR_UID = 'conductor-uid-001';
const CONDUCTOR_TOKEN = makeTestToken(CONDUCTOR_UID, UserRole.CONDUCTOR, 'conductor@test.uy');
const OPERATOR_TOKEN = makeTestToken('operator-uid', UserRole.OPERATOR, 'operator@test.uy');

describe('Transfer endpoints — integración HTTP', () => {
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

  describe('POST /api/tracking/traslados/:reservationId/iniciar', () => {
    it('inicia el traslado correctamente (happy path)', async () => {
      await seedVehicle(pgPool, { id: VEHICLE_ID, gpsDeviceId: DEVICE_ID });

      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ vehicleId: VEHICLE_ID, deviceId: DEVICE_ID });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_TRANSIT');
      expect(res.body.reservationId).toBe(RESERVATION_ID);
    });

    it('retorna 401 sin JWT', async () => {
      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .send({ vehicleId: VEHICLE_ID, deviceId: DEVICE_ID });

      expect(res.status).toBe(401);
    });

    it('retorna 403 cuando el rol no es CONDUCTOR', async () => {
      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .set('Authorization', `Bearer ${OPERATOR_TOKEN}`)
        .send({ vehicleId: VEHICLE_ID, deviceId: DEVICE_ID });

      expect(res.status).toBe(403);
    });

    it('retorna 404 cuando el vehículo no está registrado', async () => {
      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ vehicleId: 'test-vehicle-inexistente', deviceId: DEVICE_ID });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/tracking/traslados/:reservationId/finalizar', () => {
    it('finaliza el traslado correctamente (happy path)', async () => {
      await seedVehicle(pgPool, { id: VEHICLE_ID, gpsDeviceId: DEVICE_ID });

      await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ vehicleId: VEHICLE_ID, deviceId: DEVICE_ID });

      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/finalizar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ deviceId: DEVICE_ID });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('retorna 409 al intentar finalizar un traslado ya completado', async () => {
      await seedVehicle(pgPool, { id: VEHICLE_ID, gpsDeviceId: DEVICE_ID });

      await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/iniciar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ vehicleId: VEHICLE_ID, deviceId: DEVICE_ID });

      await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/finalizar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ deviceId: DEVICE_ID });

      const res = await request(app)
        .post(`/api/tracking/traslados/${RESERVATION_ID}/finalizar`)
        .set('Authorization', `Bearer ${CONDUCTOR_TOKEN}`)
        .send({ deviceId: DEVICE_ID });

      expect(res.status).toBe(409);
    });
  });
});
