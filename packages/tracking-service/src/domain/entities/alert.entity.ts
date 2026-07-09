import { AlertType } from '@move/shared';

export interface AlertProps {
  readonly id: string;
  readonly transferId: string;
  readonly type: AlertType;
  readonly lat: number;
  readonly lng: number;
  readonly message: string;
  readonly createdAt: Date;
}

export class Alert {
  readonly id: string;
  readonly transferId: string;
  readonly type: AlertType;
  readonly lat: number;
  readonly lng: number;
  readonly message: string;
  readonly createdAt: Date;

  constructor(props: AlertProps) {
    this.id = props.id;
    this.transferId = props.transferId;
    this.type = props.type;
    this.lat = props.lat;
    this.lng = props.lng;
    this.message = props.message;
    this.createdAt = props.createdAt;
  }
}
