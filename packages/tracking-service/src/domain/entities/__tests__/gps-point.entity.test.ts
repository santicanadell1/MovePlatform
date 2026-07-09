import { GpsPoint } from '../gps-point.entity';

function makeGpsPoint(transferId: string | null = null): GpsPoint {
  return new GpsPoint({
    id: 'point-001',
    deviceId: 'device-001',
    transferId,
    lat: -34.9,
    lng: -56.1,
    speed: 50,
    heading: 90,
    accuracy: 5,
    timestamp: new Date('2026-01-01T12:00:00Z'),
  });
}

describe('GpsPoint entity', () => {
  describe('hasActiveTransfer', () => {
    it('retorna true cuando tiene un transferId', () => {
      expect(makeGpsPoint('transfer-001').hasActiveTransfer()).toBe(true);
    });

    it('retorna false cuando transferId es null', () => {
      expect(makeGpsPoint(null).hasActiveTransfer()).toBe(false);
    });
  });

  describe('withTransfer', () => {
    it('retorna un nuevo GpsPoint con el transferId asignado', () => {
      const point = makeGpsPoint(null);
      const enriched = point.withTransfer('transfer-001');

      expect(enriched.transferId).toBe('transfer-001');
      expect(enriched.deviceId).toBe(point.deviceId);
      expect(enriched.lat).toBe(point.lat);
    });

    it('no muta la instancia original', () => {
      const point = makeGpsPoint(null);
      point.withTransfer('transfer-001');

      expect(point.transferId).toBeNull();
    });
  });
});
