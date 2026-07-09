import { ClientType, UserRole } from '@move/shared';

import { User } from '../../../domain/entities/user.entity';
import { UserAlreadyExistsError } from '../../../domain/errors/auth.errors';
import { RegisterUserUseCase } from '../register-user.use-case';

import { InMemoryAuthService } from './doubles/in-memory-auth.service';
import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

describe('RegisterUserUseCase', () => {
  let repo: InMemoryUserRepository;
  let auth: InMemoryAuthService;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    auth = new InMemoryAuthService();
    useCase = new RegisterUserUseCase(repo, auth);
  });

  it('creates a PARTICULAR user and persists it', async () => {
    const result = await useCase.execute({
      type: ClientType.PARTICULAR,
      name: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'secret123',
    });

    expect(result).toBeInstanceOf(User);
    expect(result.email).toBe('juan@example.com');
    expect(result.name).toBe('Juan Pérez');
    expect(result.role).toBe(UserRole.CLIENT_PARTICULAR);
    expect(result.type).toBe(ClientType.PARTICULAR);
    expect(result.firebaseUid).toBeDefined();
  });

  it('creates an EMPRESA user with companyName and correct role', async () => {
    const result = await useCase.execute({
      type: ClientType.EMPRESA,
      name: 'María García',
      email: 'maria@empresa.com',
      password: 'secret456',
      companyName: 'Empresa S.A.',
    });

    expect(result).toBeInstanceOf(User);
    expect(result.role).toBe(UserRole.CLIENT_EMPRESA);
    expect(result.type).toBe(ClientType.EMPRESA);
    expect(result.companyName).toBe('Empresa S.A.');
  });

  it('throws UserAlreadyExistsError when email is already registered', async () => {
    await useCase.execute({
      type: ClientType.PARTICULAR,
      name: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'secret123',
    });

    await expect(
      useCase.execute({
        type: ClientType.PARTICULAR,
        name: 'Juan Pérez',
        email: 'juan@example.com',
        password: 'secret123',
      }),
    ).rejects.toThrow(UserAlreadyExistsError);
  });

  it('deletes the Firebase user when repo.save fails (rollback)', async () => {
    repo.failNextSave();

    await expect(
      useCase.execute({
        type: ClientType.PARTICULAR,
        name: 'Ana López',
        email: 'ana@example.com',
        password: 'secret789',
      }),
    ).rejects.toThrow('DB save failed');

    expect(auth.hasUserWithEmail('ana@example.com')).toBe(false);
  });
});
