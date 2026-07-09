import { injectable, inject } from 'inversify';
import { ReservationStatus } from '@move/shared';

import { Good } from '../../domain/entities/good.entity';
import { Reservation } from '../../domain/entities/reservation.entity';
import type {
  IReservationRepository,
  ReservationFilters,
  ReservationPage,
  ReservationWithGoods,
} from '../../domain/ports/reservation.repository.port';
import { PrismaClient } from '../../generated/client';

type PrismaReservationRow = {
  id: string;
  clientId: string;
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  scheduledDate: Date;
  status: string;
  totalCost: { toNumber(): number } | null;
  costBreakdown: unknown;
  vehicleId: string | null;
  conductorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  goods?: Array<{
    id: string;
    reservationId: string;
    description: string;
    value: { toNumber(): number } | null;
    size: string | null;
    quantity: number;
    categoryId: string | null;
    productId: string | null;
    classificationStrategy: string | null;
    classificationConfidence: number | null;
    createdAt: Date;
  }>;
};

function toGood(row: NonNullable<PrismaReservationRow['goods']>[number]): Good {
  return Good.create({
    id: row.id,
    reservationId: row.reservationId,
    description: row.description,
    value: row.value?.toNumber() ?? null,
    size: (row.size as never) ?? null,
    quantity: row.quantity,
    categoryId: row.categoryId,
    productId: row.productId,
    classificationStrategy: row.classificationStrategy,
    classificationConfidence: row.classificationConfidence,
    createdAt: row.createdAt,
  });
}

function toReservation(row: PrismaReservationRow): Reservation {
  return Reservation.create({
    id: row.id,
    clientId: row.clientId,
    origin: row.origin,
    destination: row.destination,
    originLat: row.originLat ?? 0,
    originLng: row.originLng ?? 0,
    destinationLat: row.destinationLat ?? 0,
    destinationLng: row.destinationLng ?? 0,
    scheduledDate: row.scheduledDate,
    status: row.status as ReservationStatus,
    totalCost: row.totalCost?.toNumber() ?? null,
    costBreakdown: (row.costBreakdown as never) ?? null,
    vehicleId: row.vehicleId,
    conductorId: row.conductorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    goods: row.goods?.map(toGood),
  });
}

@injectable()
export class PrismaReservationRepository implements IReservationRepository {
  constructor(@inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async save(reservation: Reservation, goods: Good[]): Promise<Reservation> {
    await this.prisma.reservation.create({
      data: {
        id: reservation.id,
        clientId: reservation.clientId,
        origin: reservation.origin,
        destination: reservation.destination,
        originLat: reservation.originLat,
        originLng: reservation.originLng,
        destinationLat: reservation.destinationLat,
        destinationLng: reservation.destinationLng,
        scheduledDate: reservation.scheduledDate,
        status: reservation.status,
        goods: {
          create: goods.map((g) => ({
            id: g.id,
            description: g.description,
            value: g.value,
            size: g.size ?? undefined,
            quantity: g.quantity,
            categoryId: g.categoryId ?? undefined,
            productId: g.productId ?? undefined,
            classificationStrategy: g.classificationStrategy ?? undefined,
            classificationConfidence: g.classificationConfidence ?? undefined,
          })),
        },
      },
    });
    return reservation;
  }

  async findById(id: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({ where: { id } });
    return row ? toReservation(row) : null;
  }

  async findByIdWithGoods(id: string): Promise<ReservationWithGoods | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: { goods: true },
    });
    if (!row) return null;
    return { reservation: toReservation(row), goods: (row.goods ?? []).map(toGood) };
  }

  async findByClientId(clientId: string): Promise<Reservation[]> {
    const rows = await this.prisma.reservation.findMany({ where: { clientId } });
    return rows.map(toReservation);
  }

  async updateGoods(_reservationId: string, goods: Good[]): Promise<void> {
    await this.prisma.$transaction(
      goods.map((g) =>
        this.prisma.good.update({
          where: { id: g.id },
          data: { categoryId: g.categoryId ?? undefined },
        }),
      ),
    );
  }

  async update(reservation: Reservation): Promise<Reservation> {
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: reservation.status,
        totalCost: reservation.totalCost ?? undefined,
        costBreakdown: (reservation.costBreakdown as never) ?? undefined,
      },
    });
    return reservation;
  }

  async assignFromEvent(
    reservationId: string,
    vehicleId: string,
    conductorId: string,
  ): Promise<void> {
    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        vehicleId,
        conductorId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
    });
  }

  async findWithFilters(filters: ReservationFilters): Promise<ReservationPage> {
    const { clientId, status, dateFrom, dateTo, cursor, limit } = filters;

    const rows = await this.prisma.reservation.findMany({
      where: {
        ...(clientId !== undefined && { clientId }),
        ...(status !== undefined && { status }),
        ...((dateFrom !== undefined || dateTo !== undefined) && {
          scheduledDate: {
            ...(dateFrom !== undefined && { gte: dateFrom }),
            ...(dateTo !== undefined && { lte: dateTo }),
          },
        }),
      },
      include: { goods: true },
      take: limit + 1,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id : undefined;

    return { reservations: page.map(toReservation), nextCursor };
  }
}
