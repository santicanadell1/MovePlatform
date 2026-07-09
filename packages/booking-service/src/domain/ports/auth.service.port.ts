import type { UserRole } from '@move/shared';

export interface IAuthService {
  createUser(email: string, password: string): Promise<{ uid: string }>;
  setCustomClaim(uid: string, role: UserRole): Promise<void>;
  signIn(email: string, password: string): Promise<{ token: string; uid: string }>;
  deleteUser(uid: string): Promise<void>;
}
