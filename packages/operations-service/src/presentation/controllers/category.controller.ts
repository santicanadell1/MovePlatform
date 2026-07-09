import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { GetCategoriesUseCase } from '../../application/use-cases/categories/get-categories.use-case';
import type { CreateCategoryUseCase } from '../../application/use-cases/categories/create-category.use-case';
import type { UpdateCategoryUseCase } from '../../application/use-cases/categories/update-category.use-case';
import type { DeleteCategoryUseCase } from '../../application/use-cases/categories/delete-category.use-case';
import {
  CategoryNotFoundError,
  CategoryInUseError,
  DuplicateCategoryError,
} from '../../domain/errors/category.errors';
import { TYPES } from '../../types';
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schemas';

@injectable()
export class CategoryController {
  constructor(
    @inject(TYPES.GetCategoriesUseCase)
    private readonly getUseCase: GetCategoriesUseCase,
    @inject(TYPES.CreateCategoryUseCase)
    private readonly createUseCase: CreateCategoryUseCase,
    @inject(TYPES.UpdateCategoryUseCase)
    private readonly updateUseCase: UpdateCategoryUseCase,
    @inject(TYPES.DeleteCategoryUseCase)
    private readonly deleteUseCase: DeleteCategoryUseCase,
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
    const parsed = createCategorySchema.safeParse(req.body);
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
      if (err instanceof DuplicateCategoryError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_CATEGORY', message: err.message } });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateCategorySchema.safeParse(req.body);
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
        categoryId: String(req.params['categoryId']),
        ...parsed.data,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof CategoryNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'CATEGORY_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof DuplicateCategoryError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'DUPLICATE_CATEGORY', message: err.message } });
        return;
      }
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute({ categoryId: String(req.params['categoryId']) });
      res.status(204).send();
    } catch (err) {
      if (err instanceof CategoryNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'CATEGORY_NOT_FOUND', message: err.message } });
        return;
      }
      if (err instanceof CategoryInUseError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'CATEGORY_IN_USE', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
