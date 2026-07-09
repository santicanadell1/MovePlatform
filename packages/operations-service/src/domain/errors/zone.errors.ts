export class ZoneNotFoundError extends Error {
  constructor(id: string) {
    super(`Zona no encontrada: ${id}`);
    this.name = 'ZoneNotFoundError';
  }
}

export class InvalidPolygonError extends Error {
  constructor() {
    super('El polígono GeoJSON proporcionado no es válido según PostGIS');
    this.name = 'InvalidPolygonError';
  }
}
