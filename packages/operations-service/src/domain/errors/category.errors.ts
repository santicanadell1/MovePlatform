export class CategoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Categoría no encontrada: ${id}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class DuplicateCategoryError extends Error {
  constructor(nameEs: string) {
    super(`Ya existe una categoría con el nombre: ${nameEs}`);
    this.name = 'DuplicateCategoryError';
  }
}

export class CategoryInUseError extends Error {
  constructor() {
    super('No se puede eliminar: la categoría tiene reservas asociadas');
    this.name = 'CategoryInUseError';
  }
}
