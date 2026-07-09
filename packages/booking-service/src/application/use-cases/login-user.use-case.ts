import type { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/auth.errors';
import type { IAuthService } from '../../domain/ports/auth.service.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface LoginUserResult {
  token: string;
  user: User;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly authService: IAuthService,
  ) {}

  async execute(dto: LoginUserDto): Promise<LoginUserResult> {
    const { token, uid } = await this.authService.signIn(dto.email, dto.password);

    const user = await this.userRepo.findByFirebaseUid(uid);
    if (!user) throw new UserNotFoundError(uid);

    return { token, user };
  }
}
