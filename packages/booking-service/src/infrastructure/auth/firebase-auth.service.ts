import type { UserRole } from '@move/shared';
import * as admin from 'firebase-admin';
import { injectable } from 'inversify';

import { InvalidCredentialsError } from '../../domain/errors/auth.errors';
import type { IAuthService } from '../../domain/ports/auth.service.port';

@injectable()
export class FirebaseAuthService implements IAuthService {
  async createUser(email: string, password: string): Promise<{ uid: string }> {
    const record = await admin.auth().createUser({ email, password });
    return { uid: record.uid };
  }

  async setCustomClaim(uid: string, role: UserRole): Promise<void> {
    await admin.auth().setCustomUserClaims(uid, { role });
  }

  async signIn(email: string, password: string): Promise<{ token: string; uid: string }> {
    const apiKey = process.env['FIREBASE_API_KEY'];
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    if (!res.ok) throw new InvalidCredentialsError();

    const data = (await res.json()) as { idToken: string; localId: string };
    return { token: data.idToken, uid: data.localId };
  }

  async deleteUser(uid: string): Promise<void> {
    await admin.auth().deleteUser(uid);
  }
}
