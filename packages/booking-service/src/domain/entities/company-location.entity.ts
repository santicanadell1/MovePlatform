export interface CompanyLocationProps {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CompanyLocation {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: CompanyLocationProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.name = props.name;
    this.address = props.address;
    this.lat = props.lat;
    this.lng = props.lng;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: CompanyLocationProps): CompanyLocation {
    return new CompanyLocation(props);
  }

  withName(name: string): CompanyLocation {
    return CompanyLocation.create({ ...this, name });
  }

  withAddress(address: string, lat: number, lng: number): CompanyLocation {
    return CompanyLocation.create({ ...this, address, lat, lng });
  }
}
