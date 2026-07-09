import CircuitBreaker from 'opossum';

import type { Coordinates, IGeolocationService } from '../../domain/ports/geolocation.service.port';

interface OrsResponse {
  routes: Array<{ summary: { distance: number; duration: number } }>;
}

export interface OrsCircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
}

export class OrsGeolocationService implements IGeolocationService {
  private readonly cb: CircuitBreaker;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    fallback: IGeolocationService,
    cbOptions: OrsCircuitBreakerOptions = {},
  ) {
    const action = (origin: Coordinates, destination: Coordinates) =>
      this._callOrs(origin, destination);

    this.cb = new CircuitBreaker(action, {
      timeout: cbOptions.timeout ?? 5000,
      errorThresholdPercentage: cbOptions.errorThresholdPercentage ?? 50,
      resetTimeout: cbOptions.resetTimeout ?? 30000,
      volumeThreshold: cbOptions.volumeThreshold ?? 10,
    });

    this.cb.fallback((origin: Coordinates, destination: Coordinates) =>
      fallback.getDistanceKm(origin, destination),
    );
  }

  async getDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
    return this.cb.fire(origin, destination) as Promise<number>;
  }

  private async _callOrs(origin: Coordinates, destination: Coordinates): Promise<number> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = this.apiKey;

    const res = await fetch(`${this.baseUrl}/v2/directions/driving-car/json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // ORS usa orden GeoJSON: [lng, lat] — NO [lat, lng]
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
    });

    if (!res.ok) throw new Error(`ORS responded with ${res.status.toString()}`);

    const data = (await res.json()) as OrsResponse;
    const distanceMeters = data.routes[0]?.summary.distance;
    if (distanceMeters === undefined) throw new Error('ORS: empty routes in response');

    return Math.round((distanceMeters / 1000) * 100) / 100;
  }
}
