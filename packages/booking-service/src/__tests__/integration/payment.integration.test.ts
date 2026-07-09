import { randomUUID } from 'node:crypto';

import request from 'supertest';
import type { Application } from 'express';
import { ReservationStatus } from '@move/shared';

import type { PrismaClient } from '../../generated/client';
import { buildTestApp } from '../../test-utils/build-test-app';
import { cleanDatabase } from '../../test-utils/db-cleaner';

describe('Pago HTTP — POST /v1/reservas/:id/pagar', () => {
  let app: Application;
  let prisma: PrismaClient;
  let ownerToken: string;
  let otherToken: string;
  let ownerUserId: string;

  const OWNER_EMAIL = 'owner@move.uy';
  const OTHER_EMAIL = 'other@move.uy';
  const PASSWORD = 'pass12345';

  beforeAll(async () => {
    const result = await buildTestApp();
    app = result.app;
    prisma = result.prisma;

    await cleanDatabase(prisma);

    // Registrar owner y obtener token + userId
    await request(app).post('/v1/auth/register').send({
      type: 'PARTICULAR',
      name: 'Owner',
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    const ownerLogin = await request(app).post('/v1/auth/login').send({
      email: OWNER_EMAIL,
      password: PASSWORD,
    });
    ownerToken = ownerLogin.body.data.token as string;
    const ownerUser = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
    ownerUserId = ownerUser!.id;

    // Registrar other y obtener token
    await request(app).post('/v1/auth/register').send({
      type: 'PARTICULAR',
      name: 'Other',
      email: OTHER_EMAIL,
      password: PASSWORD,
    });
    const otherLogin = await request(app).post('/v1/auth/login').send({
      email: OTHER_EMAIL,
      password: PASSWORD,
    });
    otherToken = otherLogin.body.data.token as string;
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.good.deleteMany();
    await prisma.reservation.deleteMany();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  async function seedQuotedReservation(totalCost: number): Promise<string> {
    const r = await prisma.reservation.create({
      data: {
        id: randomUUID(),
        clientId: ownerUserId,
        origin: 'Origen Test',
        destination: 'Destino Test',
        originLat: -34.9011,
        originLng: -56.1645,
        destinationLat: -34.9111,
        destinationLng: -56.1745,
        scheduledDate: new Date(Date.now() + 86_400_000),
        status: ReservationStatus.QUOTED,
        totalCost,
        costBreakdown: {},
      },
    });
    return r.id;
  }

  it('returns 200 with status=APPROVED when payment succeeds (amount ≤ 100k)', async () => {
    const id = await seedQuotedReservation(5_000);

    const res = await request(app)
      .post(`/v1/reservas/${id}/pagar`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reservationId).toBe(id);
  });

  it('returns 200 with status=REJECTED when gateway rejects (amount > 100k ≤ 500k)', async () => {
    const id = await seedQuotedReservation(200_000);

    const res = await request(app)
      .post(`/v1/reservas/${id}/pagar`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.errorMessage).toBeTruthy();
  });

  it('returns 404 when reservation does not exist', async () => {
    const res = await request(app)
      .post(`/v1/reservas/${randomUUID()}/pagar`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when user is not the reservation owner', async () => {
    const id = await seedQuotedReservation(5_000);

    const res = await request(app)
      .post(`/v1/reservas/${id}/pagar`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when reservation is not QUOTED', async () => {
    const r = await prisma.reservation.create({
      data: {
        id: randomUUID(),
        clientId: ownerUserId,
        origin: 'A',
        destination: 'B',
        originLat: -34.9,
        originLng: -56.1,
        destinationLat: -34.91,
        destinationLng: -56.17,
        scheduledDate: new Date(Date.now() + 86_400_000),
        status: ReservationStatus.PENDING_CLASSIFICATION,
        totalCost: null,
        costBreakdown: {},
      },
    });

    const res = await request(app)
      .post(`/v1/reservas/${r.id}/pagar`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  it('returns 503 when circuit breaker is open', async () => {
    // amount > 500k → MockPaymentGateway lanza excepción → opossum lo cuenta como fallo
    const ids = await Promise.all(Array.from({ length: 5 }, () => seedQuotedReservation(600_000)));

    await Promise.allSettled(
      ids.map((id) =>
        request(app).post(`/v1/reservas/${id}/pagar`).set('Authorization', `Bearer ${ownerToken}`),
      ),
    );

    // Esperar a que opossum procese las fallas y abra el CB
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const freshId = await seedQuotedReservation(1_000);
    const res = await request(app)
      .post(`/v1/reservas/${freshId}/pagar`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GATEWAY_UNAVAILABLE');
  }, 20_000);
});
