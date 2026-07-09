import type { User } from '../../../../domain/entities/user.entity';
import type { IUserRepository, UserFilters } from '../../../../domain/ports/user.repository.port';

export class InMemoryUserRepository implements IUserRepository {
  private users: User[] = [];

  seed(users: User[]): void {
    this.users = [...users];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(filters: UserFilters): Promise<User[]> {
    return this.users.filter((u) => {
      if (filters.role !== undefined && u.role !== filters.role) return false;
      if (filters.status !== undefined && u.status !== filters.status) return false;
      return true;
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(user: User): Promise<User> {
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) this.users[idx] = user;
    return user;
  }
}
