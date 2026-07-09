import { ReservationStatus } from '@move/shared';
import type { ReservationClassifiedEvent } from '@move/shared';

import { Good } from '../../../domain/entities/good.entity';
import { Reservation } from '../../../domain/entities/reservation.entity';
import type { QuoteReservationUseCase } from '../quote-reservation.use-case';
import { ResumeClassifiedReservationUseCase } from '../resume-classified-reservation.use-case';

import { InMemoryReservationRepository } from './doubles/in-memory-reservation.repository';

function makeReservation(
  status: ReservationStatus = ReservationStatus.PENDING_CLASSIFICATION,
): Reservation {
  return Reservation.create({
    id: 'res-1',
    clientId: 'client-1',
    origin: 'Origen',
    destination: 'Destino',
    originLat: -34.9,
    originLng: -56.2,
    destinationLat: -34.85,
    destinationLng: -56.15,
    scheduledDate: new Date(Date.now() + 86400000),
    status,
    totalCost: null,
    costBreakdown: null,
    vehicleId: null,
    conductorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeGood(overrides: Partial<{ categoryId: string | null }> = {}): Good {
  return Good.create({
    id: 'good-1',
    reservationId: 'res-1',
    description: 'televisor',
    value: null,
    size: null,
    quantity: 1,
    categoryId: overrides.categoryId ?? null,
    productId: null,
    classificationStrategy: null,
    classificationConfidence: null,
    createdAt: new Date(),
  });
}

function makeClassifiedEvent(reservationId = 'res-1'): ReservationClassifiedEvent {
  return {
    eventId: 'evt-1',
    occurredAt: new Date().toISOString(),
    reservationId,
    categoryId: 'cat-electronica',
    categoryName: 'Electrónica',
  };
}

function makeQuoteStub(
  result?: Reservation,
): jest.Mocked<Pick<QuoteReservationUseCase, 'execute'>> {
  return {
    execute: jest.fn().mockResolvedValue(
      result ??
        Reservation.create({
          ...makeReservation(),
          status: ReservationStatus.QUOTED,
          totalCost: 100,
          costBreakdown: null,
        }),
    ),
  };
}

describe('ResumeClassifiedReservationUseCase', () => {
  it('asigna categoryId a los goods y llama a quote cuando la reserva está en PENDING_CLASSIFICATION', async () => {
    const repo = new InMemoryReservationRepository();
    const reservation = makeReservation(ReservationStatus.PENDING_CLASSIFICATION);
    const good = makeGood({ categoryId: null });
    await repo.save(reservation, [good]);

    const quoteStub = makeQuoteStub();
    const uc = new ResumeClassifiedReservationUseCase(
      repo,
      quoteStub as unknown as QuoteReservationUseCase,
    );

    await uc.execute(makeClassifiedEvent());

    const updatedGoods = repo.getGoods('res-1');
    expect(updatedGoods[0]?.categoryId).toBe('cat-electronica');
    expect(quoteStub.execute).toHaveBeenCalledWith(
      'res-1',
      expect.arrayContaining([expect.objectContaining({ categoryId: 'cat-electronica' })]),
    );
  });

  it('asigna la misma categoryId a todos los goods sin categoría', async () => {
    const repo = new InMemoryReservationRepository();
    const reservation = makeReservation(ReservationStatus.PENDING_CLASSIFICATION);
    const goods = [
      Good.create({ ...makeGood(), id: 'g1', categoryId: null }),
      Good.create({ ...makeGood(), id: 'g2', categoryId: null }),
      Good.create({ ...makeGood(), id: 'g3', categoryId: null }),
    ];
    await repo.save(reservation, goods);

    const uc = new ResumeClassifiedReservationUseCase(
      repo,
      makeQuoteStub() as unknown as QuoteReservationUseCase,
    );
    await uc.execute(makeClassifiedEvent());

    const updatedGoods = repo.getGoods('res-1');
    expect(updatedGoods).toHaveLength(3);
    updatedGoods.forEach((g) => expect(g.categoryId).toBe('cat-electronica'));
  });

  it('no hace nada si la reserva no existe (idempotente, no lanza error)', async () => {
    const repo = new InMemoryReservationRepository();
    const quoteStub = makeQuoteStub();
    const uc = new ResumeClassifiedReservationUseCase(
      repo,
      quoteStub as unknown as QuoteReservationUseCase,
    );

    await expect(uc.execute(makeClassifiedEvent('reserva-inexistente'))).resolves.toBeUndefined();
    expect(quoteStub.execute).not.toHaveBeenCalled();
  });

  it('no cotiza si la reserva ya tiene status distinto de PENDING_CLASSIFICATION', async () => {
    const repo = new InMemoryReservationRepository();
    const reservation = makeReservation(ReservationStatus.QUOTED);
    await repo.save(reservation, [makeGood()]);

    const quoteStub = makeQuoteStub();
    const uc = new ResumeClassifiedReservationUseCase(
      repo,
      quoteStub as unknown as QuoteReservationUseCase,
    );

    await uc.execute(makeClassifiedEvent());

    expect(quoteStub.execute).not.toHaveBeenCalled();
  });

  it('no sobreescribe goods que ya tenían categoryId', async () => {
    const repo = new InMemoryReservationRepository();
    const reservation = makeReservation(ReservationStatus.PENDING_CLASSIFICATION);
    const goodWithCategory = makeGood({ categoryId: 'cat-existente' });
    await repo.save(reservation, [goodWithCategory]);

    const uc = new ResumeClassifiedReservationUseCase(
      repo,
      makeQuoteStub() as unknown as QuoteReservationUseCase,
    );
    await uc.execute(makeClassifiedEvent());

    const updatedGoods = repo.getGoods('res-1');
    expect(updatedGoods[0]?.categoryId).toBe('cat-existente');
  });
});
