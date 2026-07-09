import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import type { GetUsersUseCase } from '../../application/use-cases/users/get-users.use-case';
import type { UpdateUserStatusUseCase } from '../../application/use-cases/users/update-user-status.use-case';
import { UserNotFoundError } from '../../domain/errors/user.errors';
import { TYPES } from '../../types';
import { listUsersQuerySchema, updateUserStatusSchema } from '../schemas/user.schemas';

@injectable()
export class UserController {
  constructor(
    @inject(TYPES.GetUsersUseCase)
    private readonly getUseCase: GetUsersUseCase,
    @inject(TYPES.UpdateUserStatusUseCase)
    private readonly updateStatusUseCase: UpdateUserStatusUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listUsersQuerySchema.safeParse(req.query);
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

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateUserStatusSchema.safeParse(req.body);
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
      const result = await this.updateStatusUseCase.execute({
        userId: String(req.params['id']),
        status: parsed.data.status,
      });
      res.status(200).json({ data: result, error: null });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        res
          .status(404)
          .json({ data: null, error: { code: 'USER_NOT_FOUND', message: err.message } });
        return;
      }
      next(err);
    }
  };
}
