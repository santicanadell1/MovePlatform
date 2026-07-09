export interface GpsPointProps {
  readonly id: string;
  readonly deviceId: string;
  readonly transferId: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly accuracy: number | null;
  readonly timestamp: Date;
}

export class GpsPoint {
  readonly id: string;
  readonly deviceId: string;
  readonly transferId: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly accuracy: number | null;
  readonly timestamp: Date;

  constructor(props: GpsPointProps) {
    this.id = props.id;
    this.deviceId = props.deviceId;
    this.transferId = props.transferId;
    this.lat = props.lat;
    this.lng = props.lng;
    this.speed = props.speed;
    this.heading = props.heading;
    this.accuracy = props.accuracy;
    this.timestamp = props.timestamp;
  }

  hasActiveTransfer(): boolean {
    return this.transferId !== null;
  }

  withTransfer(transferId: string): GpsPoint {
    return new GpsPoint({ ...this, transferId });
  }
}
