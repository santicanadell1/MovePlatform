import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { CreateCompanyLocationUseCase } from '../../application/use-cases/company-locations/create-company-location.use-case';
import type { DeleteCompanyLocationUseCase } from '../../application/use-cases/company-locations/delete-company-location.use-case';
import type { ListCompanyLocationsUseCase } from '../../application/use-cases/company-locations/list-company-locations.use-case';
import type { UpdateCompanyLocationUseCase } from '../../application/use-cases/company-locations/update-company-location.use-case';
import {
  DuplicateLocationNameError,
  LocationNotFoundError,
  LocationOwnershipError,
} from '../../domain/errors/company.errors';
import { TYPES } from '../../types';
import {
  createCompanyLocationSchema,
  updateCompanyLocationSchema,
} from '../schemas/company-location.schemas';

@injectable()
export class CompanyLocationController {
  constructor(
    @inject(TYPES.CreateCompanyLocationUseCase)
    private readonly createUseCase: CreateCompanyLocationUseCase,
    @inject(TYPES.ListCompanyLocationsUseCase)
    private readonly listUseCase: ListCompanyLocationsUseCase,
    @inject(TYPES.UpdateCompanyLocationUseCase)
    private readonly updateUseCase: UpdateCompanyLocationUseCase,
    @inject(TYPES.DeleteCompanyLocationUseCase)
    private readonly deleteUseCase: DeleteCompanyLocationUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createCompanyLocationSchema.safeParse(req.body);
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
      const result = await this.createUseCase.execute({
        firebaseUid: req.user!.uid,
        name: parsed.data.name,
        address: parsed.data.address,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      });
      res.status(201).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof DuplicateLocationNameError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_LOCATION', message: err.message } });
        return;
      }
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listUseCase.execute(req.user!.uid);
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateCompanyLocationSchema.safeParse(req.body);
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
        firebaseUid: req.user!.uid,
        locationId: String(req.params['locationId']),
        name: parsed.data.name,
        address: parsed.data.address,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof LocationNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'LOCATION_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof LocationOwnershipError) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      if (err instanceof DuplicateLocationNameError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_LOCATION', message: err.message } });
        return;
      }
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({
        firebaseUid: req.user!.uid,
        locationId: String(req.params['locationId']),
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof LocationNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'LOCATION_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof LocationOwnershipError) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
