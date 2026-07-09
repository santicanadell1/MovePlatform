import { randomUUID } from 'node:crypto';

import { ReservationStatus, GoodSize } from '@move/shared';

import { Reservation } from '../../domain/entities/reservation.entity';
import { Good } from '../../domain/entities/good.entity';
import type { CompanyProduct } from '../../domain/entities/company-product.entity';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import type { ICompanyProductRepository } from '../../domain/ports/company-product.repository.port';
import type { ITopClientsCache } from '../../domain/ports/top-clients-cache.port';
import {
  InvalidReservationDateError,
  EmptyGoodsError,
  ProductNotPreregisteredError,
} from '../../domain/errors/reservation.errors';
import { reservationsCreatedTotal } from '../../infrastructure/metrics/metrics';

import type { QuoteReservationUseCase } from './quote-reservation.use-case';

export interface CreateEmpresaReservationInput {
  firebaseUid: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  scheduledDate: Date;
  goods: ReadonlyArray<{
    productId: string;
    description?: string;
    value?: number;
    size?: GoodSize;
    quantity?: number;
  }>;
}

export class CreateEmpresaReservationUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly reservationRepo: IReservationRepository,
    private readonly companyProductRepo: ICompanyProductRepository,
    private readonly quoteUseCase: QuoteReservationUseCase,
    private readonly cache: ITopClientsCache,
  ) {}

  async execute(input: CreateEmpresaReservationInput): Promise<Reservation> {
    if (input.scheduledDate <= new Date()) throw new InvalidReservationDateError();
    if (!input.goods.length) throw new EmptyGoodsError();

    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    let clientProducts: CompanyProduct[];
    try {
      const cached = await this.cache.getCachedProducts(user.id);
      clientProducts = cached ?? (await this.companyProductRepo.findByClientId(user.id));
    } catch {
      clientProducts = await this.companyProductRepo.findByClientId(user.id);
    }

    const now = new Date();
    const reservationId = randomUUID();

    const goods: Good[] = [];
    for (const g of input.goods) {
      const product = clientProducts.find((p) => p.id === g.productId);
      if (!product) {
        throw new ProductNotPreregisteredError(g.productId);
      }

      goods.push(
        Good.create({
          id: randomUUID(),
          reservationId,
          description: g.description ?? product.name,
          value: g.value ?? null,
          size: g.size ?? null,
          quantity: g.quantity ?? 1,
          categoryId: product.categoryId,
          productId: product.id,
          classificationStrategy: 'preregistered',
          classificationConfidence: 1,
          createdAt: now,
        }),
      );
    }

    const reservation = Reservation.create({
      id: reservationId,
      clientId: user.id,
      origin: input.origin,
      destination: input.destination,
      originLat: input.originLat,
      originLng: input.originLng,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      scheduledDate: input.scheduledDate,
      status: ReservationStatus.PENDING_QUOTE,
      totalCost: null,
      costBreakdown: null,
      vehicleId: null,
      conductorId: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.reservationRepo.save(reservation, goods);
    reservationsCreatedTotal.inc({ client_type: 'empresa' });

    return this.quoteUseCase.execute(reservationId, goods);
  }
}
