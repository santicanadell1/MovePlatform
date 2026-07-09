import type { UserRole } from '@move/shared';

import { InvalidCredentialsError } from '../../../../domain/errors/auth.errors';
import type { IAuthService } from '../../../../domain/ports/auth.service.port';

interface StoredUser {
  uid: string;
  email: string;
  password: string;
  role?: UserRole;
}

export class InMemoryAuthService implements IAuthService {
  private users: StoredUser[] = [];
  private counter = 1;

  // eslint-disable-next-line @typescript-eslint/require-await
  async createUser(email: string, password: string): Promise<{ uid: string }> {
    const uid = `firebase-uid-${this.counter++}`;
    this.users.push({ uid, email, password });
    return { uid };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async setCustomClaim(uid: string, role: UserRole): Promise<void> {
    const u = this.users.find((x) => x.uid === uid);
    if (u) u.role = role;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async signIn(email: string, password: string): Promise<{ token: string; uid: string }> {
    const u = this.users.find((x) => x.email === email && x.password === password);
    if (!u) throw new InvalidCredentialsError();
    return { token: `token-for-${u.uid}`, uid: u.uid };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteUser(uid: string): Promise<void> {
    this.users = this.users.filter((x) => x.uid !== uid);
  }

  hasUserWithEmail(email: string): boolean {
    return this.users.some((x) => x.email === email);
  }
}
