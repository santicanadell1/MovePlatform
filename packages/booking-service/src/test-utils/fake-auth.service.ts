import { UserRole } from '@move/shared';

import { InvalidCredentialsError } from '../domain/errors/auth.errors';
import type { IAuthService } from '../domain/ports/auth.service.port';

interface StoredUser {
  uid: string;
  email: string;
  password: string;
  role: UserRole;
}

/**
 * IAuthService en memoria — sin Firebase.
 * createUser genera UIDs secuenciales ("fake-uid-1", "fake-uid-2"...).
 * El store usa el email como clave: registrar un email ya existente lo recrea
 * con un nuevo uid, igual que en la DB tras un cleanDatabase. Así signIn siempre
 * devuelve el usuario actual (sincronizado con el firebaseUid guardado en la DB).
 * signIn lanza InvalidCredentialsError igual que FirebaseAuthService, para que
 * el controller lo mapee a 401.
 */
export class FakeAuthService implements IAuthService {
  private readonly usersByEmail = new Map<string, StoredUser>();
  private counter = 0;

  // eslint-disable-next-line @typescript-eslint/require-await
  async createUser(email: string, password: string): Promise<{ uid: string }> {
    const uid = `fake-uid-${++this.counter}`;
    this.usersByEmail.set(email, { uid, email, password, role: UserRole.CLIENT_PARTICULAR });
    return { uid };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async setCustomClaim(uid: string, role: UserRole): Promise<void> {
    for (const user of this.usersByEmail.values()) {
      if (user.uid === uid) {
        user.role = role;
        return;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async signIn(email: string, password: string): Promise<{ token: string; uid: string }> {
    const user = this.usersByEmail.get(email);
    if (!user || user.password !== password) {
      throw new InvalidCredentialsError();
    }
    return {
      token: `test:${user.uid}:${user.role}:${user.email}`,
      uid: user.uid,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteUser(uid: string): Promise<void> {
    for (const [email, user] of this.usersByEmail.entries()) {
      if (user.uid === uid) {
        this.usersByEmail.delete(email);
        return;
      }
    }
  }
}
