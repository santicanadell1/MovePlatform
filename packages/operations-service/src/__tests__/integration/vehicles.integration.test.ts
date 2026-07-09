import 'reflect-metadata';

import request from 'supertest';
import type { Application } from 'express';
import { UserRole } from '@move/shared';
import type { Pool } from 'pg';

import type { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDatabase } from '../../test-utils/db-cleaner';
import { makeTestToken } from '../../test-utils/fake-auth.verifier';

const ADMIN_TOKEN = makeTestToken('admin-uid-1', UserRole.ADMIN, 'admin@move.uy');

const BASE_VEHICLE = {
  plate: 'ABC1234',
  type: 'VAN',
  capacity: 5,
  gpsDeviceId: 'GPS-001',
};

describe('Vehículos HTTP — /api/operaciones/vehiculos', () => {
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

  describe('POST /api/operaciones/vehiculos', () => {
    it('crea un vehículo con datos válidos → 201', async () => {
      const res = await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toMatchObject({ plate: 'ABC1234', type: 'VAN', capacity: 5 });
      expect(res.body.data.id).toBeDefined();
    });

    it('retorna 409 cuando la matrícula ya existe', async () => {
      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      const res = await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ ...BASE_VEHICLE, gpsDeviceId: 'GPS-002' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_PLATE');
    });

    it('retorna 409 cuando el gpsDeviceId ya existe', async () => {
      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      const res = await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ ...BASE_VEHICLE, plate: 'XYZ9999' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_GPS_DEVICE_ID');
    });

    it('retorna 400 con datos inválidos (capacity negativa)', async () => {
      const res = await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ ...BASE_VEHICLE, capacity: -1 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/operaciones/vehiculos', () => {
    it('lista todos los vehículos sin filtros → 200', async () => {
      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      const res = await request(app)
        .get('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toHaveLength(1);
    });

    it('filtra por available=true → solo vehículos disponibles', async () => {
      const v1Res = await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ plate: 'DEF5678', type: 'TRUCK', capacity: 10, gpsDeviceId: 'GPS-002' });

      await prisma.vehicle.update({
        where: { id: v1Res.body.data.id as string },
        data: { available: false },
      });

      const res = await request(app)
        .get('/api/operaciones/vehiculos?available=true')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].plate).toBe('DEF5678');
    });

    it('filtra por type → solo vehículos del tipo pedido', async () => {
      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send(BASE_VEHICLE);

      await request(app)
        .post('/api/operaciones/vehiculos')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ plate: 'DEF5678', type: 'TRUCK', capacity: 10 });

      const res = await request(app)
        .get('/api/operaciones/vehiculos?type=VAN')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('VAN');
    });
  });
});
