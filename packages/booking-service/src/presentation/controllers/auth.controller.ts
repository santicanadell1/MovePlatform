import { injectable, inject } from 'inversify';
import type { Request, Response, NextFunction } from 'express';

import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../../domain/errors/auth.errors';
import type { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import type { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { TYPES } from '../../types';
import { LoginSchema, RegisterSchema } from '../schemas/auth.schemas';

@injectable()
export class AuthController {
  constructor(
    @inject(TYPES.RegisterUserUseCase) private readonly registerUseCase: RegisterUserUseCase,
    @inject(TYPES.LoginUseCase) private readonly loginUseCase: LoginUserUseCase,
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = RegisterSchema.safeParse(req.body);
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
      const user = await this.registerUseCase.execute(parsed.data);
      res.status(201).json({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          type: user.type,
          companyName: user.companyName,
          phone: user.phone,
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        res
          .status(409)
          .json({ data: null, error: { code: 'USER_ALREADY_EXISTS', message: err.message } });
        return;
      }
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = LoginSchema.safeParse(req.body);
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
      const result = await this.loginUseCase.execute(parsed.data);
      res.status(200).json({
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            role: result.user.role,
            type: result.user.type,
          },
        },
        error: null,
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError || err instanceof UserNotFoundError) {
        res.status(401).json({
          data: null,
          error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' },
        });
        return;
      }
      next(err);
    }
  };
}
