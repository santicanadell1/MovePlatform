import { NextFunction, Request, Response } from 'express';

import { UserRole } from '../enums';

export interface AuthPayload {
  readonly uid: string;
  readonly email: string;
  readonly role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export interface IAuthVerifier {
  verifyToken(token: string): Promise<AuthPayload>;
}

export const createAuthMiddleware = (verifier: IAuthVerifier) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autorización requerido' });
      return;
    }

    const token = authHeader.slice(7);

    try {
      req.user = await verifier.verifyToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return;
    }

    next();
  };
};
