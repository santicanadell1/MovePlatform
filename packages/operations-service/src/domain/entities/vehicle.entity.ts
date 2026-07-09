export interface VehicleProps {
  readonly id: string;
  readonly plate: string;
  readonly type: string;
  readonly capacity: number;
  readonly gpsDeviceId: string | null;
  readonly available: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Vehicle {
  readonly id: string;
  readonly plate: string;
  readonly type: string;
  readonly capacity: number;
  readonly gpsDeviceId: string | null;
  readonly available: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: VehicleProps) {
    this.id = props.id;
    this.plate = props.plate;
    this.type = props.type;
    this.capacity = props.capacity;
    this.gpsDeviceId = props.gpsDeviceId;
    this.available = props.available;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: VehicleProps): Vehicle {
    return new Vehicle(props);
  }

  withPlate(plate: string): Vehicle {
    return Vehicle.create({ ...this, plate, updatedAt: new Date() });
  }

  withType(type: string): Vehicle {
    return Vehicle.create({ ...this, type, updatedAt: new Date() });
  }

  withCapacity(capacity: number): Vehicle {
    return Vehicle.create({ ...this, capacity, updatedAt: new Date() });
  }

  withGpsDeviceId(gpsDeviceId: string | null): Vehicle {
    return Vehicle.create({ ...this, gpsDeviceId, updatedAt: new Date() });
  }

  withAvailable(available: boolean): Vehicle {
    return Vehicle.create({ ...this, available, updatedAt: new Date() });
  }
}
