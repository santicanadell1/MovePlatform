import { MockGeolocationService } from '../mock-geolocation.service';
import { OrsGeolocationService } from '../ors-geolocation.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const makeOrsResponse = (distanceMeters: number) => ({
  routes: [{ summary: { distance: distanceMeters, duration: 300 } }],
});

const ORIGIN = { lat: -34.9, lng: -56.2 };
const DEST = { lat: -34.88, lng: -56.17 };

describe('OrsGeolocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna distancia en km cuando ORS responde OK', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeOrsResponse(12340)),
    });
    const svc = new OrsGeolocationService('http://ors:8080', '', new MockGeolocationService());

    const km = await svc.getDistanceKm(ORIGIN, DEST);

    expect(km).toBe(12.34);
  });

  it('envía coordinates en orden [lng, lat] — GeoJSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeOrsResponse(5000)),
    });
    const svc = new OrsGeolocationService('http://ors:8080', '', new MockGeolocationService());

    await svc.getDistanceKm(ORIGIN, DEST);

    const calls = mockFetch.mock.calls as [string, { body: string }][];
    const body = JSON.parse(calls[0][1].body) as { coordinates: [number, number][] };
    expect(body.coordinates[0]).toEqual([ORIGIN.lng, ORIGIN.lat]);
    expect(body.coordinates[1]).toEqual([DEST.lng, DEST.lat]);
  });

  it('envía Authorization header cuando apiKey no es vacío', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeOrsResponse(5000)),
    });
    const svc = new OrsGeolocationService(
      'http://ors:8080',
      'MY_KEY',
      new MockGeolocationService(),
    );

    await svc.getDistanceKm(ORIGIN, DEST);

    const calls = mockFetch.mock.calls as [string, { headers: Record<string, string> }][];
    expect(calls[0][1].headers['Authorization']).toBe('MY_KEY');
  });

  it('no envía Authorization header cuando apiKey es vacío', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeOrsResponse(5000)),
    });
    const svc = new OrsGeolocationService('http://ors:8080', '', new MockGeolocationService());

    await svc.getDistanceKm(ORIGIN, DEST);

    const calls = mockFetch.mock.calls as [string, { headers: Record<string, string> }][];
    expect(calls[0][1].headers['Authorization']).toBeUndefined();
  });

  it('usa fallback Haversine cuando ORS devuelve HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    const fallback = new MockGeolocationService();
    const expected = await fallback.getDistanceKm(ORIGIN, DEST);
    // CB con umbrales mínimos para que abra en la primera llamada fallida
    const svc = new OrsGeolocationService('http://ors:8080', '', fallback, {
      errorThresholdPercentage: 0,
      volumeThreshold: 0,
    });

    const km = await svc.getDistanceKm(ORIGIN, DEST);

    expect(km).toBeCloseTo(expected, 1);
  });

  it('usa fallback Haversine cuando fetch lanza una excepción', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const fallback = new MockGeolocationService();
    const expected = await fallback.getDistanceKm(ORIGIN, DEST);
    const svc = new OrsGeolocationService('http://ors:8080', '', fallback, {
      errorThresholdPercentage: 0,
      volumeThreshold: 0,
    });

    const km = await svc.getDistanceKm(ORIGIN, DEST);

    expect(km).toBeCloseTo(expected, 1);
  });
});
