import { injectable, inject } from 'inversify';
import type { UserRole } from '@move/shared';

import { UserNotFoundError } from '../../../domain/errors/user.errors';
import { UserStatus } from '../../../domain/entities/user.entity';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface UpdateUserStatusInput {
  readonly userId: string;
  readonly status: UserStatus;
}

export interface UpdateUserStatusOutput {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class UpdateUserStatusUseCase {
  constructor(
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserStatusInput): Promise<UpdateUserStatusOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    const updated = await this.userRepo.update(user.withStatus(input.status));
    return {
      id: updated.id,
      name: updated.name,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
