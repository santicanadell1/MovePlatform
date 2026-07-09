export type ZoneType = 'RED' | 'PREFERRED';

export interface GeoJsonPolygon {
  readonly type: 'Polygon';
  readonly coordinates: number[][][];
}

export interface ZoneProps {
  readonly id: string;
  readonly name: string;
  readonly type: ZoneType;
  readonly geom: GeoJsonPolygon;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Zone {
  readonly id: string;
  readonly name: string;
  readonly type: ZoneType;
  readonly geom: GeoJsonPolygon;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ZoneProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.geom = props.geom;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ZoneProps): Zone {
    return new Zone(props);
  }

  withName(name: string): Zone {
    return Zone.create({ ...this, name, updatedAt: new Date() });
  }

  withType(type: ZoneType): Zone {
    return Zone.create({ ...this, type, updatedAt: new Date() });
  }

  withGeom(geom: GeoJsonPolygon): Zone {
    return Zone.create({ ...this, geom, updatedAt: new Date() });
  }
}
