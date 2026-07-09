import type { User } from '../../../../domain/entities/user.entity';
import type { IUserRepository } from '../../../../domain/ports/user.repository.port';

export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];
  private _failNextSave = false;

  failNextSave(): void {
    this._failNextSave = true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByFirebaseUid(uid: string): Promise<User | null> {
    return this.users.find((u) => u.firebaseUid === uid) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(user: User): Promise<User> {
    if (this._failNextSave) {
      this._failNextSave = false;
      throw new Error('DB save failed');
    }
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.users[idx] = user;
    } else {
      this.users.push(user);
    }
    return user;
  }
}
