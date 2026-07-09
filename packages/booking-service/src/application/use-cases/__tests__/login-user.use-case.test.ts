import { ClientType } from '@move/shared';

import { InvalidCredentialsError } from '../../../domain/errors/auth.errors';
import { LoginUserUseCase } from '../login-user.use-case';
import { RegisterUserUseCase } from '../register-user.use-case';

import { InMemoryAuthService } from './doubles/in-memory-auth.service';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

describe('LoginUserUseCase', () => {
  let repo: InMemoryUserRepository;
  let auth: InMemoryAuthService;
  let loginUseCase: LoginUserUseCase;
  let registerUseCase: RegisterUserUseCase;

  beforeEach(async () => {
    repo = new InMemoryUserRepository();
    auth = new InMemoryAuthService();
    loginUseCase = new LoginUserUseCase(repo, auth);
    registerUseCase = new RegisterUserUseCase(repo, auth);

    await registerUseCase.execute({
      type: ClientType.PARTICULAR,
      name: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'secret123',
    });
  });

  it('returns token and user when credentials are valid', async () => {
    const result = await loginUseCase.execute({
      email: 'juan@example.com',
      password: 'secret123',
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('juan@example.com');
  });

  it('throws InvalidCredentialsError when password is wrong', async () => {
    await expect(
      loginUseCase.execute({
        email: 'juan@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
