import { randomUUID } from 'node:crypto';

import {
  ReservationStatus,
  GoodSize,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
} from '@move/shared';
import type { ReservationUnclassifiedEvent } from '@move/shared';

import { Reservation } from '../../domain/entities/reservation.entity';
import { Good } from '../../domain/entities/good.entity';
import type { ICategoryRepository } from '../../domain/ports/category.repository.port';
import type { ICategoryEmbeddingRepository } from '../../domain/ports/category-embedding.repository.port';
import type { IEmbeddingService } from '../../domain/ports/embedding.service.port';
import type { IJobQueue } from '../../domain/ports/job-queue.port';
import type { IReservationRepository } from '../../domain/ports/reservation.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import type { IEventPublisher } from '../../domain/ports/event-publisher.port';
import {
  InvalidReservationDateError,
  EmptyGoodsError,
} from '../../domain/errors/reservation.errors';
import type { ISseNotifier } from '../../domain/ports/sse-notifier.port';
import type { ClassificationCascadeService } from '../services/classification-cascade.service';
import { reservationsCreatedTotal } from '../../infrastructure/metrics/metrics';

import type { QuoteReservationUseCase } from './quote-reservation.use-case';

export interface CreateParticularReservationInput {
  firebaseUid: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  scheduledDate: Date;
  goods: ReadonlyArray<{
    description: string;
    value?: number;
    size?: GoodSize;
    quantity?: number;
  }>;
}

export class CreateParticularReservationUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly reservationRepo: IReservationRepository,
    private readonly quoteUseCase: QuoteReservationUseCase,
    private readonly cascade: ClassificationCascadeService,
    private readonly eventPublisher: IEventPublisher,
    private readonly jobQueue: IJobQueue,
    private readonly sseNotifier: ISseNotifier,
    private readonly categoryRepo?: ICategoryRepository,
    private readonly embeddingService?: IEmbeddingService,
    private readonly embeddingRepo?: ICategoryEmbeddingRepository,
  ) {}

  /**
   * Pre-selecciona las categorías candidatas para el LLM. Si hay embeddings
   * disponibles, devuelve el top-10 por similitud (patrón retrieval+rerank:
   * prompt corto → LLM más rápido y preciso). Si no, devuelve todas.
   */
  private async selectCandidateCategories(
    description: string,
  ): Promise<Array<{ id: string; name: string; examples?: string[] }>> {
    if (!this.categoryRepo) return [];
    const all = await this.categoryRepo.findAllForAi();

    if (this.embeddingService && this.embeddingRepo) {
      try {
        const embedding = await this.embeddingService.embed(description);
        const top = await this.embeddingRepo.findNearestTopK(embedding, 10);
        if (top.length > 0) {
          const byId = new Map(all.map((c) => [c.id, c]));
          const candidates = top
            .map((t) => byId.get(t.categoryId))
            .filter((c): c is { id: string; name: string; examples: string[] } => c !== undefined);
          if (candidates.length > 0) return candidates;
        }
      } catch {
        // Si falla embeddings/Ollama, caemos al listado completo.
      }
    }

    return all;
  }

  async execute(input: CreateParticularReservationInput): Promise<Reservation> {
    if (input.scheduledDate <= new Date()) throw new InvalidReservationDateError();
    if (!input.goods.length) throw new EmptyGoodsError();

    for (const g of input.goods) {
      if (!g.description?.trim()) throw new Error('Cada bien debe tener una descripción');
    }

    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const now = new Date();
    const reservationId = randomUUID();

    const goods: Good[] = [];
    for (const g of input.goods) {
      const classificationResult = await this.cascade.classifySync(g.description);

      goods.push(
        Good.create({
          id: randomUUID(),
          reservationId,
          description: g.description,
          value: g.value ?? null,
          size: g.size ?? null,
          quantity: g.quantity ?? 1,
          categoryId: classificationResult?.categoryId ?? null,
          productId: null,
          classificationStrategy: classificationResult?.strategy ?? null,
          classificationConfidence: classificationResult?.confidence ?? null,
          createdAt: now,
        }),
      );
    }

    const allClassified = goods.every((g) => g.categoryId !== null);
    const status = allClassified
      ? ReservationStatus.PENDING_QUOTE
      : ReservationStatus.PENDING_CLASSIFICATION;

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
      status,
      totalCost: null,
      costBreakdown: null,
      vehicleId: null,
      conductorId: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.reservationRepo.save(reservation, goods);
    reservationsCreatedTotal.inc({ client_type: 'particular' });

    if (status === ReservationStatus.PENDING_CLASSIFICATION) {
      const unclassifiedDescriptions = input.goods
        .filter((_, i) => goods[i]?.categoryId === null)
        .map((g) => g.description)
        .join(', ');

      const event: ReservationUnclassifiedEvent = {
        eventId: randomUUID(),
        occurredAt: now.toISOString(),
        reservationId,
        clientId: user.id,
        clientEmail: user.email,
        goodDescription: unclassifiedDescriptions,
      };
      await this.eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.RESERVATION_UNCLASSIFIED,
        event,
      );

      const categories = await this.selectCandidateCategories(unclassifiedDescriptions);
      await this.jobQueue.enqueue({
        reservationId,
        goodDescription: unclassifiedDescriptions,
        categories,
      });

      await this.sseNotifier.notify({
        reservationId,
        goodDescription: unclassifiedDescriptions,
        clientEmail: user.email,
        occurredAt: now.toISOString(),
      });

      return reservation;
    }

    return this.quoteUseCase.execute(reservationId, goods);
  }
}
