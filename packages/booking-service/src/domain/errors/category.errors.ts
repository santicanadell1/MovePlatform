export class CategoryNotFoundError extends Error {
  readonly _tag = 'CategoryNotFoundError';
  constructor(id: string) {
    super(`Categoría no encontrada: ${id}`);
  }
}

export class ReservationNotPendingClassificationError extends Error {
  readonly _tag = 'ReservationNotPendingClassificationError';
  constructor(id: string) {
    super(`La reserva ${id} no está en estado PENDING_CLASSIFICATION`);
  }
}
