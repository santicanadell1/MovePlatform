import { randomUUID } from 'node:crypto';

import { ClientType, UserRole } from '@move/shared';

import { User } from '../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../domain/errors/auth.errors';
import type { IAuthService } from '../../domain/ports/auth.service.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

export interface RegisterUserDto {
  type: ClientType;
  name: string;
  email: string;
  password: string;
  companyName?: string;
  phone?: string;
}

function resolveRole(type: ClientType): UserRole {
  return type === ClientType.EMPRESA ? UserRole.CLIENT_EMPRESA : UserRole.CLIENT_PARTICULAR;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: IAuthService,
  ) {}

  async execute(dto: RegisterUserDto): Promise<User> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new UserAlreadyExistsError(dto.email);

    const role = resolveRole(dto.type);

    const { uid } = await this.authService.createUser(dto.email, dto.password);
    await this.authService.setCustomClaim(uid, role);

    const now = new Date();
    const user = new User({
      id: randomUUID(),
      firebaseUid: uid,
      role,
      type: dto.type,
      name: dto.name,
      email: dto.email,
      companyName: dto.companyName ?? null,
      phone: dto.phone ?? null,
      createdAt: now,
      updatedAt: now,
    });

    try {
      return await this.userRepo.save(user);
    } catch (err) {
      await this.authService.deleteUser(uid);
      throw err;
    }
  }
}
