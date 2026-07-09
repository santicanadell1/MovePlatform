import request from 'supertest';
import type { Application } from 'express';

import type { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDatabase } from '../../test-utils/db-cleaner';

const VALID_USER = {
  type: 'PARTICULAR' as const,
  name: 'Test User',
  email: 'test@move.uy',
  password: 'password123',
};

describe('Auth HTTP — /v1/auth', () => {
  let app: Application;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
    prisma = result.prisma;
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── POST /v1/auth/register ──────────────────────────────────────────

  describe('POST /v1/auth/register', () => {
    it('returns 201 with user data on valid registration', async () => {
      const res = await request(app).post('/v1/auth/register').send(VALID_USER);

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();
      expect(res.body.data).toMatchObject({
        email: VALID_USER.email,
        name: VALID_USER.name,
        role: 'CLIENT_PARTICULAR',
        type: 'PARTICULAR',
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('returns 409 when email is already registered', async () => {
      await request(app).post('/v1/auth/register').send(VALID_USER);

      const res = await request(app).post('/v1/auth/register').send(VALID_USER);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('returns 400 on invalid email format', async () => {
      const res = await request(app)
        .post('/v1/auth/register')
        .send({ ...VALID_USER, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on password shorter than 8 chars', async () => {
      const res = await request(app)
        .post('/v1/auth/register')
        .send({ ...VALID_USER, password: '1234567' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── POST /v1/auth/login ─────────────────────────────────────────────

  describe('POST /v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/v1/auth/register').send(VALID_USER);
    });

    it('returns 200 with token on valid credentials', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.token).toMatch(/^test:/);
      expect(res.body.data.user.email).toBe(VALID_USER.email);
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: VALID_USER.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 on unknown email', async () => {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'nobody@move.uy', password: VALID_USER.password });

      expect(res.status).toBe(401);
    });

    it('returns 400 on missing password', async () => {
      const res = await request(app).post('/v1/auth/login').send({ email: VALID_USER.email });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
