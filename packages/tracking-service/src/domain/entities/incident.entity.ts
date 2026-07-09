export interface IncidentProps {
  readonly id: string;
  readonly transferId: string;
  readonly conductorId: string;
  readonly description: string;
  readonly createdAt: Date;
}

export class Incident {
  readonly id: string;
  readonly transferId: string;
  readonly conductorId: string;
  readonly description: string;
  readonly createdAt: Date;

  constructor(props: IncidentProps) {
    this.id = props.id;
    this.transferId = props.transferId;
    this.conductorId = props.conductorId;
    this.description = props.description;
    this.createdAt = props.createdAt;
  }
}
