export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`Usuario no encontrado: ${id}`);
    this.name = 'UserNotFoundError';
  }
}
