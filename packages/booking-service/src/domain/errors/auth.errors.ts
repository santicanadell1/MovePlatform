export class DomainError extends Error {
  readonly _tag = 'DomainError';
}

export class UserAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`El usuario con email ${email} ya existe`);
    this.name = 'UserAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Credenciales inválidas');
    this.name = 'InvalidCredentialsError';
  }
}

export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Usuario no encontrado: ${identifier}`);
    this.name = 'UserNotFoundError';
  }
}
