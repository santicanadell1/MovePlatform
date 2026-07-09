export class ProductNotFoundError extends Error {
  constructor(id: string) {
    super(`Producto no encontrado: ${id}`);
    this.name = 'ProductNotFoundError';
  }
}

export class DuplicateProductNameError extends Error {
  constructor(name: string) {
    super(`Ya existe un producto con el nombre: ${name}`);
    this.name = 'DuplicateProductNameError';
  }
}

export class LocationNotFoundError extends Error {
  constructor(id: string) {
    super(`Ubicación no encontrada: ${id}`);
    this.name = 'LocationNotFoundError';
  }
}

export class DuplicateLocationNameError extends Error {
  constructor(name: string) {
    super(`Ya existe una ubicación con el nombre: ${name}`);
    this.name = 'DuplicateLocationNameError';
  }
}

export class ProductOwnershipError extends Error {
  constructor() {
    super('No tenés permiso para modificar este producto');
    this.name = 'ProductOwnershipError';
  }
}

export class LocationOwnershipError extends Error {
  constructor() {
    super('No tenés permiso para modificar esta ubicación');
    this.name = 'LocationOwnershipError';
  }
}
