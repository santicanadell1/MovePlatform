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

const VALID_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [-56.2, -34.9],
      [-56.1, -34.9],
      [-56.1, -34.8],
      [-56.2, -34.8],
      [-56.2, -34.9],
    ],
  ],
};

// Bowtie — ST_IsValid retorna false
const INVALID_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [-56.2, -34.9],
      [-56.1, -34.8],
      [-56.1, -34.9],
      [-56.2, -34.8],
      [-56.2, -34.9],
    ],
  ],
};

describe('Zonas HTTP — /api/zonas', () => {
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

  describe('POST /api/zonas', () => {
    it('crea una zona con GeoJSON válido → 201', async () => {
      const res = await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Zona Centro', type: 'RED', geom: VALID_POLYGON });

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toMatchObject({ name: 'Zona Centro', type: 'RED' });
      expect(res.body.data.id).toBeDefined();
    });

    it('retorna 422 cuando el polígono no es válido (ST_IsValid = false)', async () => {
      const res = await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Zona Inválida', type: 'RED', geom: INVALID_POLYGON });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_POLYGON');
    });

    it('retorna 400 cuando falta el campo geom', async () => {
      const res = await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Zona Sin Geom', type: 'RED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('retorna 401 sin token de auth', async () => {
      const res = await request(app)
        .post('/api/zonas')
        .send({ name: 'X', type: 'RED', geom: VALID_POLYGON });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/zonas', () => {
    it('lista las zonas existentes → 200', async () => {
      await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Zona Lista', type: 'PREFERRED', geom: VALID_POLYGON });

      const res = await request(app)
        .get('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ name: 'Zona Lista', type: 'PREFERRED' });
    });

    it('retorna lista vacía cuando no hay zonas → 200', async () => {
      const res = await request(app)
        .get('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('PUT /api/zonas/:zoneId', () => {
    it('modifica el nombre de una zona → 200', async () => {
      const createRes = await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Nombre Original', type: 'RED', geom: VALID_POLYGON });

      const zoneId = createRes.body.data.id as string;

      const res = await request(app)
        .put(`/api/zonas/${zoneId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Nombre Modificado' });

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.name).toBe('Nombre Modificado');
    });

    it('retorna 404 para zona inexistente', async () => {
      const res = await request(app)
        .put('/api/zonas/no-existe-id')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Nuevo Nombre' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ZONE_NOT_FOUND');
    });
  });

  describe('DELETE /api/zonas/:zoneId', () => {
    it('elimina una zona existente → 204', async () => {
      const createRes = await request(app)
        .post('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ name: 'Para Eliminar', type: 'RED', geom: VALID_POLYGON });

      const zoneId = createRes.body.data.id as string;

      const res = await request(app)
        .delete(`/api/zonas/${zoneId}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(204);

      const listRes = await request(app)
        .get('/api/zonas')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      expect(listRes.body.data).toHaveLength(0);
    });

    it('retorna 404 para zona inexistente', async () => {
      const res = await request(app)
        .delete('/api/zonas/no-existe-id')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ZONE_NOT_FOUND');
    });
  });
});
