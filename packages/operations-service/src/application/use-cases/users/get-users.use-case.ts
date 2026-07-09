import { injectable, inject } from 'inversify';
import type { UserRole } from '@move/shared';

import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { UserStatus } from '../../../domain/entities/user.entity';
import { TYPES } from '../../../types';

export interface GetUsersInput {
  readonly role?: UserRole;
  readonly status?: UserStatus;
}

export interface UserOutput {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class GetUsersUseCase {
  constructor(
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: GetUsersInput = {}): Promise<UserOutput[]> {
    const users = await this.userRepo.findAll(input);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }
}
