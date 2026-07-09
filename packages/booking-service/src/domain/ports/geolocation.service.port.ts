export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface IGeolocationService {
  getDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number>;
}
