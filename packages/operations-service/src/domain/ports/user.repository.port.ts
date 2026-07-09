import type { UserRole } from '@move/shared';

import type { User, UserStatus } from '../entities/user.entity';

export interface UserFilters {
  readonly role?: UserRole;
  readonly status?: UserStatus;
}

export interface IUserRepository {
  findAll(filters: UserFilters): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  update(user: User): Promise<User>;
}
