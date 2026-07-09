import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../enums';
export interface AuthPayload {
  readonly uid: string;
  readonly email: string;
  readonly role: UserRole;
}
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
export interface IAuthVerifier {
  verifyToken(token: string): Promise<AuthPayload>;
}
export declare const createAuthMiddleware: (
  verifier: IAuthVerifier,
) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authorize: (
  ...roles: UserRole[]
) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map
