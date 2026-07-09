import type { Coordinates, IGeolocationService } from '../../domain/ports/geolocation.service.port';

const EARTH_RADIUS_KM = 6371;

function haversineKm(origin: Coordinates, destination: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class MockGeolocationService implements IGeolocationService {
  getDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
    return Promise.resolve(Math.round(haversineKm(origin, destination) * 100) / 100);
  }
}
