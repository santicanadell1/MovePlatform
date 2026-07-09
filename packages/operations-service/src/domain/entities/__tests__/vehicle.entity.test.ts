import { Vehicle } from '../vehicle.entity';

function makeVehicle(overrides: Partial<Parameters<typeof Vehicle.create>[0]> = {}): Vehicle {
  return Vehicle.create({
    id: 'v-1',
    plate: 'ABC 1234',
    type: 'sedan',
    capacity: 10,
    gpsDeviceId: 'gps-1',
    available: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
}

describe('Vehicle entity', () => {
  describe('create', () => {
    it('preserva todos los campos al construirse', () => {
      const vehicle = makeVehicle();

      expect(vehicle.id).toBe('v-1');
      expect(vehicle.plate).toBe('ABC 1234');
      expect(vehicle.type).toBe('sedan');
      expect(vehicle.capacity).toBe(10);
      expect(vehicle.gpsDeviceId).toBe('gps-1');
      expect(vehicle.available).toBe(true);
      expect(vehicle.createdAt).toBeInstanceOf(Date);
    });

    it('acepta gpsDeviceId null', () => {
      const vehicle = makeVehicle({ gpsDeviceId: null });
      expect(vehicle.gpsDeviceId).toBeNull();
    });

    it('acepta available=false', () => {
      const vehicle = makeVehicle({ available: false });
      expect(vehicle.available).toBe(false);
    });
  });

  describe('withCapacity', () => {
    it('retorna un nuevo vehículo con la capacidad actualizada', () => {
      const original = makeVehicle({ capacity: 10 });
      const updated = original.withCapacity(20);

      expect(updated.capacity).toBe(20);
      expect(updated.id).toBe(original.id);
    });

    it('no muta la instancia original', () => {
      const original = makeVehicle({ capacity: 10 });
      original.withCapacity(20);

      expect(original.capacity).toBe(10);
    });
  });

  describe('withAvailable', () => {
    it('marca el vehículo como no disponible', () => {
      const vehicle = makeVehicle({ available: true });
      const updated = vehicle.withAvailable(false);

      expect(updated.available).toBe(false);
    });

    it('marca el vehículo como disponible nuevamente', () => {
      const vehicle = makeVehicle({ available: false });
      const updated = vehicle.withAvailable(true);

      expect(updated.available).toBe(true);
    });

    it('no muta la instancia original', () => {
      const vehicle = makeVehicle({ available: true });
      vehicle.withAvailable(false);

      expect(vehicle.available).toBe(true);
    });
  });

  describe('withPlate', () => {
    it('retorna un nuevo vehículo con la matrícula actualizada', () => {
      const original = makeVehicle();
      const updated = original.withPlate('XYZ 9999');

      expect(updated.plate).toBe('XYZ 9999');
    });

    it('no muta la instancia original', () => {
      const original = makeVehicle();
      original.withPlate('XYZ 9999');

      expect(original.plate).toBe('ABC 1234');
    });
  });

  describe('withGpsDeviceId', () => {
    it('actualiza el gpsDeviceId', () => {
      const vehicle = makeVehicle({ gpsDeviceId: 'gps-1' });
      const updated = vehicle.withGpsDeviceId('gps-new');

      expect(updated.gpsDeviceId).toBe('gps-new');
    });

    it('permite limpiar el gpsDeviceId a null', () => {
      const vehicle = makeVehicle({ gpsDeviceId: 'gps-1' });
      const updated = vehicle.withGpsDeviceId(null);

      expect(updated.gpsDeviceId).toBeNull();
    });

    it('no muta la instancia original', () => {
      const vehicle = makeVehicle({ gpsDeviceId: 'gps-1' });
      vehicle.withGpsDeviceId(null);

      expect(vehicle.gpsDeviceId).toBe('gps-1');
    });
  });
});
