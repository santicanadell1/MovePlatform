export class ReservationNotFoundError extends Error {
  readonly _tag = 'ReservationNotFoundError';
  constructor(id: string) {
    super(`Reserva no encontrada: ${id}`);
  }
}

export class InvalidReservationDateError extends Error {
  readonly _tag = 'InvalidReservationDateError';
  constructor() {
    super('La fecha de la reserva debe ser futura');
  }
}

export class EmptyGoodsError extends Error {
  readonly _tag = 'EmptyGoodsError';
  constructor() {
    super('La reserva debe tener al menos un bien');
  }
}

export class ProductNotPreregisteredError extends Error {
  readonly _tag = 'ProductNotPreregisteredError';
  constructor(productId: string) {
    super(`El producto ${productId} no está preregistrado para este cliente`);
  }
}

export class ReservationNotQuotedError extends Error {
  readonly _tag = 'ReservationNotQuotedError';
  constructor(id: string) {
    super(`La reserva ${id} no está en estado QUOTED`);
  }
}

export class PaymentAlreadyExistsError extends Error {
  readonly _tag = 'PaymentAlreadyExistsError';
  constructor(reservationId: string) {
    super(`Ya existe un pago para la reserva ${reservationId}`);
  }
}

export class ReservationOwnershipError extends Error {
  readonly _tag = 'ReservationOwnershipError';
  constructor(reservationId: string) {
    super(`No tiene permiso para pagar la reserva ${reservationId}`);
  }
}

export class PaymentGatewayUnavailableError extends Error {
  readonly _tag = 'PaymentGatewayUnavailableError';
  constructor() {
    super('Servicio de pago no disponible, intente más tarde');
  }
}
