import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { AssignReservationUseCase } from '../../application/use-cases/operations/assign-reservation.use-case';
import type { GetActiveTransfersUseCase } from '../../application/use-cases/operations/get-active-transfers.use-case';
import {
  ReservationNotFoundError,
  InvalidReservationStatusError,
  ConductorNotFoundError,
  InsufficientCapacityError,
  VehicleNotAvailableError,
  ScheduleConflictError,
} from '../../domain/errors/reservation-assignment.errors';
import { TYPES } from '../../types';
import {
  assignReservationBodySchema,
  listTransfersQuerySchema,
} from '../schemas/operations.schemas';

@injectable()
export class OperationsController {
  constructor(
    @inject(TYPES.AssignReservationUseCase)
    private readonly assignUseCase: AssignReservationUseCase,
    @inject(TYPES.GetActiveTransfersUseCase)
    private readonly listTransfersUseCase: GetActiveTransfersUseCase,
  ) {}

  assignReservation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = assignReservationBodySchema.safeParse(req.body);
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
      const result = await this.assignUseCase.execute({
        reservationId: String(req.params['reservationId']),
        vehicleId: parsed.data.vehicleId,
        conductorId: parsed.data.conductorId,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof ReservationNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'RESERVATION_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof InvalidReservationStatusError) {
        res.status(409).json({
          data: null,
          error: { code: 'INVALID_RESERVATION_STATUS', message: err.message },
        });
        return;
      }
      if (err instanceof ConductorNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'CONDUCTOR_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof InsufficientCapacityError) {
        res
          .status(422)
          .json({ data: null, error: { code: 'INSUFFICIENT_CAPACITY', message: err.message } });
        return;
      }
      if (err instanceof VehicleNotAvailableError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'VEHICLE_NOT_AVAILABLE', message: err.message } });
        return;
      }
      if (err instanceof ScheduleConflictError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'SCHEDULE_CONFLICT', message: err.message } });
        return;
      }
      next(err);
    }
  };

  listTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listTransfersQuerySchema.safeParse(req.query);
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

    try {
      const result = await this.listTransfersUseCase.execute({
        status: parsed.data.status,
        vehicleId: parsed.data.vehicleId,
        conductorId: parsed.data.conductorId,
        categoryId: parsed.data.categoryId,
        hasAlerts: parsed.data.hasAlerts,
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };
}
