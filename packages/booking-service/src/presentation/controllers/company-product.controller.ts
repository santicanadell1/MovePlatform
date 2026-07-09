import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { CreateCompanyProductUseCase } from '../../application/use-cases/company-products/create-company-product.use-case';
import type { DeleteCompanyProductUseCase } from '../../application/use-cases/company-products/delete-company-product.use-case';
import type { ListCompanyProductsUseCase } from '../../application/use-cases/company-products/list-company-products.use-case';
import type { UpdateCompanyProductUseCase } from '../../application/use-cases/company-products/update-company-product.use-case';
import {
  DuplicateProductNameError,
  ProductNotFoundError,
  ProductOwnershipError,
} from '../../domain/errors/company.errors';
import { TYPES } from '../../types';
import {
  createCompanyProductSchema,
  updateCompanyProductSchema,
} from '../schemas/company-product.schemas';

@injectable()
export class CompanyProductController {
  constructor(
    @inject(TYPES.CreateCompanyProductUseCase)
    private readonly createUseCase: CreateCompanyProductUseCase,
    @inject(TYPES.ListCompanyProductsUseCase)
    private readonly listUseCase: ListCompanyProductsUseCase,
    @inject(TYPES.UpdateCompanyProductUseCase)
    private readonly updateUseCase: UpdateCompanyProductUseCase,
    @inject(TYPES.DeleteCompanyProductUseCase)
    private readonly deleteUseCase: DeleteCompanyProductUseCase,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createCompanyProductSchema.safeParse(req.body);
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
        categoryId: parsed.data.categoryId,
      });
      res.status(201).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof DuplicateProductNameError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_PRODUCT', message: err.message } });
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
    const parsed = updateCompanyProductSchema.safeParse(req.body);
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
        productId: String(req.params['productId']),
        name: parsed.data.name,
        categoryId: parsed.data.categoryId,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'PRODUCT_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof ProductOwnershipError) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      if (err instanceof DuplicateProductNameError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_PRODUCT', message: err.message } });
        return;
      }
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({
        firebaseUid: req.user!.uid,
        productId: String(req.params['productId']),
      });
      res.status(204).send();
    } catch (err) {
      if (err instanceof ProductNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'PRODUCT_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof ProductOwnershipError) {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
