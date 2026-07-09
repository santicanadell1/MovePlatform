import { UserRole } from '@move/shared';

import { User, UserStatus } from '../../../domain/entities/user.entity';
import { UserNotFoundError } from '../../../domain/errors/user.errors';
import { GetUsersUseCase } from '../users/get-users.use-case';
import { UpdateUserStatusUseCase } from '../users/update-user-status.use-case';

import { InMemoryUserRepository } from './doubles/in-memory-user.repository';

const makeUser = (
  overrides: Partial<{
    id: string;
    firebaseUid: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): User =>
  User.create({
    id: 'u-1',
    firebaseUid: 'firebase-uid-1',
    name: 'Juan Operador',
    role: UserRole.OPERATOR,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

// ---------------------------------------------------------------------------
// GetUsersUseCase
// ---------------------------------------------------------------------------

describe('GetUsersUseCase', () => {
  it('retorna lista vacía cuando no hay usuarios', async () => {
    const repo = new InMemoryUserRepository();
    const useCase = new GetUsersUseCase(repo);

    const result = await useCase.execute({});

    expect(result).toHaveLength(0);
  });

  it('retorna todos los usuarios sin filtros', async () => {
    const repo = new InMemoryUserRepository();
    repo.seed([
      makeUser({ id: 'u-1', role: UserRole.OPERATOR }),
      makeUser({ id: 'u-2', role: UserRole.CONDUCTOR }),
    ]);
    const useCase = new GetUsersUseCase(repo);

    const result = await useCase.execute({});

    expect(result).toHaveLength(2);
  });

  it('filtra por role=OPERATOR', async () => {
    const repo = new InMemoryUserRepository();
    repo.seed([
      makeUser({ id: 'u-1', role: UserRole.OPERATOR }),
      makeUser({ id: 'u-2', role: UserRole.CONDUCTOR }),
    ]);
    const useCase = new GetUsersUseCase(repo);

    const result = await useCase.execute({ role: UserRole.OPERATOR });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u-1');
  });

  it('filtra por status=INACTIVE', async () => {
    const repo = new InMemoryUserRepository();
    repo.seed([
      makeUser({ id: 'u-1', status: UserStatus.ACTIVE }),
      makeUser({ id: 'u-2', status: UserStatus.INACTIVE }),
    ]);
    const useCase = new GetUsersUseCase(repo);

    const result = await useCase.execute({ status: UserStatus.INACTIVE });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u-2');
  });

  it('filtra por role y status combinados', async () => {
    const repo = new InMemoryUserRepository();
    repo.seed([
      makeUser({ id: 'u-1', role: UserRole.OPERATOR, status: UserStatus.ACTIVE }),
      makeUser({ id: 'u-2', role: UserRole.OPERATOR, status: UserStatus.INACTIVE }),
      makeUser({ id: 'u-3', role: UserRole.CONDUCTOR, status: UserStatus.ACTIVE }),
    ]);
    const useCase = new GetUsersUseCase(repo);

    const result = await useCase.execute({ role: UserRole.OPERATOR, status: UserStatus.ACTIVE });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u-1');
  });
});

// ---------------------------------------------------------------------------
// UpdateUserStatusUseCase
// ---------------------------------------------------------------------------

describe('UpdateUserStatusUseCase', () => {
  let repo: InMemoryUserRepository;
  let useCase: UpdateUserStatusUseCase;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    useCase = new UpdateUserStatusUseCase(repo);
  });

  it('actualiza el status del usuario a INACTIVE', async () => {
    repo.seed([makeUser()]);

    const result = await useCase.execute({ userId: 'u-1', status: UserStatus.INACTIVE });

    expect(result.status).toBe(UserStatus.INACTIVE);
    expect(result.id).toBe('u-1');
  });

  it('actualiza el status del usuario a SUSPENDED', async () => {
    repo.seed([makeUser()]);

    const result = await useCase.execute({ userId: 'u-1', status: UserStatus.SUSPENDED });

    expect(result.status).toBe(UserStatus.SUSPENDED);
  });

  it('actualiza el status del usuario a ACTIVE', async () => {
    repo.seed([makeUser({ status: UserStatus.INACTIVE })]);

    const result = await useCase.execute({ userId: 'u-1', status: UserStatus.ACTIVE });

    expect(result.status).toBe(UserStatus.ACTIVE);
  });

  it('lanza UserNotFoundError si el usuario no existe', async () => {
    await expect(
      useCase.execute({ userId: 'no-existe', status: UserStatus.INACTIVE }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
