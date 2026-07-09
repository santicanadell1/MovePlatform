import * as admin from 'firebase-admin';
import { injectable } from 'inversify';
import { IAuthVerifier, AuthPayload, UserRole } from '@move/shared';

@injectable()
export class FirebaseAuthVerifier implements IAuthVerifier {
  async verifyToken(token: string): Promise<AuthPayload> {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      role: (decoded['role'] as UserRole) ?? UserRole.CLIENT_PARTICULAR,
    };
  }
}
