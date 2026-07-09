import { AlertType } from '@move/shared';

import { Alert } from '../alert.entity';

describe('Alert entity', () => {
  it('preserva todos los campos al construirse', () => {
    const createdAt = new Date('2026-01-01T12:00:00Z');

    const alert = new Alert({
      id: 'alert-001',
      transferId: 'transfer-001',
      type: AlertType.ZONE_RED_ENTRY,
      lat: -34.9,
      lng: -56.1,
      message: 'Vehículo ingresó a zona roja',
      createdAt,
    });

    expect(alert.id).toBe('alert-001');
    expect(alert.transferId).toBe('transfer-001');
    expect(alert.type).toBe(AlertType.ZONE_RED_ENTRY);
    expect(alert.lat).toBe(-34.9);
    expect(alert.lng).toBe(-56.1);
    expect(alert.message).toBe('Vehículo ingresó a zona roja');
    expect(alert.createdAt).toBe(createdAt);
  });
});
