import { injectable, inject } from 'inversify';
import type { Request, Response } from 'express';
import { UserRole } from '@move/shared';

import { TYPES } from '../../types';
import type { ClassifyReservationUseCase } from '../../application/use-cases/classify-reservation.use-case';
import type { CreateEmpresaReservationUseCase } from '../../application/use-cases/create-empresa-reservation.use-case';
import type { CreateParticularReservationUseCase } from '../../application/use-cases/create-particular-reservation.use-case';
import type { GetReservationsUseCase } from '../../application/use-cases/get-reservations.use-case';
import type { PayReservationUseCase } from '../../application/use-cases/pay-reservation.use-case';
import type { RejectReservationUseCase } from '../../application/use-cases/reject-reservation.use-case';
import {
  CategoryNotFoundError,
  ReservationNotPendingClassificationError,
} from '../../domain/errors/category.errors';
import {
  EmptyGoodsError,
  InvalidReservationDateError,
  PaymentAlreadyExistsError,
  PaymentGatewayUnavailableError,
  ProductNotPreregisteredError,
  ReservationNotFoundError,
  ReservationNotQuotedError,
  ReservationOwnershipError,
} from '../../domain/errors/reservation.errors';
import type { SseManager } from '../../infrastructure/realtime/sse-manager';
import {
  classifyReservationBodySchema,
  createEmpresaReservationSchema,
  createParticularReservationSchema,
  listReservationsQuerySchema,
  payReservationParamsSchema,
  reservationIdParamSchema,
} from '../schemas/reservation.schemas';

@injectable()
export class ReservationController {
  constructor(
    @inject(TYPES.CreateReservationUseCase)
    private readonly createEmpresaReservation: CreateEmpresaReservationUseCase,
    @inject(TYPES.CreateParticularReservationUseCase)
    private readonly createParticularReservation: CreateParticularReservationUseCase,
    @inject(TYPES.PayReservationUseCase)
    private readonly payReservation: PayReservationUseCase,
    @inject(TYPES.GetReservationsUseCase)
    private readonly getReservations: GetReservationsUseCase,
    @inject(TYPES.SseManager)
    private readonly sseManager: SseManager,
    @inject(TYPES.ClassifyReservationUseCase)
    private readonly classifyReservation: ClassifyReservationUseCase,
    @inject(TYPES.RejectReservationUseCase)
    private readonly rejectReservation: RejectReservationUseCase,
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const role = req.user!.role;

    if (role === UserRole.CLIENT_PARTICULAR) {
      await this.createParticular(req, res);
    } else {
      await this.createEmpresa(req, res);
    }
  };

  private createEmpresa = async (req: Request, res: Response): Promise<void> => {
    const parsed = createEmpresaReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input inválido',
          details: parsed.error.issues,
        },
      });
      return;
    }

    try {
      const reservation = await this.createEmpresaReservation.execute({
        firebaseUid: req.user!.uid,
        ...parsed.data,
        scheduledDate: new Date(parsed.data.scheduledDate),
      });
      res.status(201).json({ data: this.mapReservation(reservation), error: null });
    } catch (err) {
      if (err instanceof InvalidReservationDateError || err instanceof EmptyGoodsError) {
        res
          .status(400)
          .json({ data: null, error: { code: 'INVALID_INPUT', message: (err as Error).message } });
        return;
      }
      if (err instanceof ProductNotPreregisteredError) {
        res.status(400).json({
          data: null,
          error: { code: 'PRODUCT_NOT_PREREGISTERED', message: (err as Error).message },
        });
        return;
      }
      throw err;
    }
  };

  private createParticular = async (req: Request, res: Response): Promise<void> => {
    const parsed = createParticularReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input inválido',
          details: parsed.error.issues,
        },
      });
      return;
    }

    try {
      const reservation = await this.createParticularReservation.execute({
        firebaseUid: req.user!.uid,
        ...parsed.data,
        scheduledDate: new Date(parsed.data.scheduledDate),
      });
      res.status(201).json({ data: this.mapReservation(reservation), error: null });
    } catch (err) {
      if (err instanceof InvalidReservationDateError || err instanceof EmptyGoodsError) {
        res
          .status(400)
          .json({ data: null, error: { code: 'INVALID_INPUT', message: (err as Error).message } });
        return;
      }
      throw err;
    }
  };

  private mapReservation = (reservation: {
    id: string;
    clientId: string;
    origin: string;
    destination: string;
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
    scheduledDate: Date;
    status: string;
    totalCost: number | null;
    costBreakdown: unknown;
  }) => ({
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
    totalCost: reservation.totalCost,
    costBreakdown: reservation.costBreakdown,
  });

  pay = async (req: Request, res: Response): Promise<void> => {
    const parsed = payReservationParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'ID de reserva inválido' },
      });
      return;
    }

    try {
      const payment = await this.payReservation.execute({
        reservationId: parsed.data.id,
        firebaseUid: req.user!.uid,
      });

      res.status(200).json({
        data: {
          id: payment.id,
          reservationId: payment.reservationId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          provider: payment.provider,
          providerTransactionId: payment.providerTransactionId,
          attemptedAt: payment.attemptedAt,
          completedAt: payment.completedAt,
          errorMessage: payment.errorMessage,
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof ReservationNotFoundError) {
        res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof ReservationOwnershipError) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      if (err instanceof ReservationNotQuotedError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'INVALID_STATUS', message: err.message } });
        return;
      }
      if (err instanceof PaymentAlreadyExistsError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'PAYMENT_EXISTS', message: err.message } });
        return;
      }
      if (err instanceof PaymentGatewayUnavailableError) {
        res
          .status(503)
          .json({ data: null, error: { code: 'GATEWAY_UNAVAILABLE', message: err.message } });
        return;
      }
      throw err;
    }
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const parsed = listReservationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query params inválidos',
          details: parsed.error.issues,
        },
      });
      return;
    }

    const { status, dateFrom, dateTo, cursor, limit } = parsed.data;

    const result = await this.getReservations.execute({
      firebaseUid: req.user!.uid,
      role: req.user!.role,
      status,
      dateFrom: dateFrom !== undefined ? new Date(dateFrom) : undefined,
      dateTo: dateTo !== undefined ? new Date(dateTo) : undefined,
      cursor,
      limit,
    });

    res.status(200).json({
      data: {
        reservations: result.reservations.map((r) => ({
          id: r.id,
          clientId: r.clientId,
          origin: r.origin,
          destination: r.destination,
          scheduledDate: r.scheduledDate,
          status: r.status,
          totalCost: r.totalCost,
          costBreakdown: r.costBreakdown,
          vehicleId: r.vehicleId,
          conductorId: r.conductorId,
          createdAt: r.createdAt,
          goods: (r.goods ?? []).map((g) => ({
            id: g.id,
            description: g.description,
            size: g.size,
            quantity: g.quantity,
            categoryId: g.categoryId,
            productId: g.productId,
          })),
        })),
        nextCursor: result.nextCursor ?? null,
      },
      error: null,
    });
  };

  streamNotifications = (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.sseManager.addConnection(res);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  };

  classify = async (req: Request, res: Response): Promise<void> => {
    const params = reservationIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } });
      return;
    }
    const body = classifyReservationBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Input inválido', details: body.error.issues },
      });
      return;
    }

    try {
      const result = await this.classifyReservation.execute({
        reservationId: params.data.id,
        categoryId: body.data.categoryId,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof ReservationNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'NOT_FOUND', message: (err as Error).message } });
        return;
      }
      if (err instanceof ReservationNotPendingClassificationError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'INVALID_STATUS', message: (err as Error).message } });
        return;
      }
      if (err instanceof CategoryNotFoundError) {
        res.status(404).json({
          data: null,
          error: { code: 'CATEGORY_NOT_FOUND', message: (err as Error).message },
        });
        return;
      }
      throw err;
    }
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    const params = reservationIdParamSchema.safeParse(req.params);
    if (!params.success) {
      res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'ID inválido' } });
      return;
    }

    try {
      const result = await this.rejectReservation.execute({
        reservationId: params.data.id,
      });
      res.status(200).json({ data: this.mapReservation(result), error: null });
    } catch (err) {
      if (err instanceof ReservationNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'NOT_FOUND', message: (err as Error).message } });
        return;
      }
      if (err instanceof ReservationNotPendingClassificationError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'INVALID_STATUS', message: (err as Error).message } });
        return;
      }
      throw err;
    }
  };
}
