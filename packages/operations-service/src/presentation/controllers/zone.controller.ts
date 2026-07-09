import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { GetZonesUseCase } from '../../application/use-cases/zones/get-zones.use-case';
import type { CreateZoneUseCase } from '../../application/use-cases/zones/create-zone.use-case';
import type { UpdateZoneUseCase } from '../../application/use-cases/zones/update-zone.use-case';
import type { DeleteZoneUseCase } from '../../application/use-cases/zones/delete-zone.use-case';
import { ZoneNotFoundError, InvalidPolygonError } from '../../domain/errors/zone.errors';
import { TYPES } from '../../types';
import { createZoneSchema, updateZoneSchema } from '../schemas/zone.schemas';

@injectable()
export class ZoneController {
  constructor(
    @inject(TYPES.GetZonesUseCase)
    private readonly getUseCase: GetZonesUseCase,
    @inject(TYPES.CreateZoneUseCase)
    private readonly createUseCase: CreateZoneUseCase,
    @inject(TYPES.UpdateZoneUseCase)
    private readonly updateUseCase: UpdateZoneUseCase,
    @inject(TYPES.DeleteZoneUseCase)
    private readonly deleteUseCase: DeleteZoneUseCase,
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getUseCase.execute();
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createZoneSchema.safeParse(req.body);
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
      if (err instanceof InvalidPolygonError) {
        res
          .status(422)
          .json({ data: null, error: { code: 'INVALID_POLYGON', message: err.message } });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateZoneSchema.safeParse(req.body);
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
        zoneId: String(req.params['zoneId']),
        ...parsed.data,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof ZoneNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'ZONE_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof InvalidPolygonError) {
        res
          .status(422)
          .json({ data: null, error: { code: 'INVALID_POLYGON', message: err.message } });
        return;
      }
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({ zoneId: String(req.params['zoneId']) });
      res.status(204).send();
    } catch (err) {
      if (err instanceof ZoneNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'ZONE_NOT_FOUND', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
