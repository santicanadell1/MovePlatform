import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { GetVehiclesUseCase } from '../../application/use-cases/vehicles/get-vehicles.use-case';
import type { CreateVehicleUseCase } from '../../application/use-cases/vehicles/create-vehicle.use-case';
import type { UpdateVehicleUseCase } from '../../application/use-cases/vehicles/update-vehicle.use-case';
import {
  DuplicateGpsDeviceIdError,
  DuplicatePlateError,
  VehicleNotFoundError,
} from '../../domain/errors/vehicle.errors';
import { TYPES } from '../../types';
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  updateVehicleSchema,
} from '../schemas/vehicle.schemas';

@injectable()
export class VehicleController {
  constructor(
    @inject(TYPES.GetVehiclesUseCase)
    private readonly getUseCase: GetVehiclesUseCase,
    @inject(TYPES.CreateVehicleUseCase)
    private readonly createUseCase: CreateVehicleUseCase,
    @inject(TYPES.UpdateVehicleUseCase)
    private readonly updateUseCase: UpdateVehicleUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listVehiclesQuerySchema.safeParse(req.query);
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
      const result = await this.getUseCase.execute(parsed.data);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createVehicleSchema.safeParse(req.body);
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
      const result = await this.createUseCase.execute(parsed.data);
      res.status(201).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof DuplicatePlateError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_PLATE', message: err.message } });
        return;
      }
      if (err instanceof DuplicateGpsDeviceIdError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_GPS_DEVICE_ID', message: err.message } });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateVehicleSchema.safeParse(req.body);
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
      const result = await this.updateUseCase.execute({
        vehicleId: String(req.params['vehicleId']),
        ...parsed.data,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof VehicleNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'VEHICLE_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof DuplicatePlateError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_PLATE', message: err.message } });
        return;
      }
      if (err instanceof DuplicateGpsDeviceIdError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_GPS_DEVICE_ID', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
