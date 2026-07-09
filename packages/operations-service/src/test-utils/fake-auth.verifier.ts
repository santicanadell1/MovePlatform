import type { AuthPayload, IAuthVerifier } from '@move/shared';
import { UserRole } from '@move/shared';

export class FakeAuthVerifier implements IAuthVerifier {
  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyToken(token: string): Promise<AuthPayload> {
    if (!token.startsWith('test:')) {
      throw new Error('Token no es de test');
    }
    const [, uid, role, email] = token.split(':');
    if (!uid || !role || !email) {
      throw new Error('Token de test malformado');
    }
    return { uid, email, role: role as UserRole };
  }
}

export function makeTestToken(uid: string, role: UserRole, email: string): string {
  return `test:${uid}:${role}:${email}`;
}
