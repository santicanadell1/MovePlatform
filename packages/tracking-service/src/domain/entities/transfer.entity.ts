import { TransferStatus } from '@move/shared';

export interface TransferProps {
  readonly id: string;
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
  readonly status: TransferStatus;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly createdAt: Date;
}

export class Transfer {
  readonly id: string;
  readonly reservationId: string;
  readonly vehicleId: string;
  readonly conductorId: string;
  readonly status: TransferStatus;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: TransferProps) {
    this.id = props.id;
    this.reservationId = props.reservationId;
    this.vehicleId = props.vehicleId;
    this.conductorId = props.conductorId;
    this.status = props.status;
    this.startedAt = props.startedAt;
    this.finishedAt = props.finishedAt;
    this.createdAt = props.createdAt;
  }

  isPending(): boolean {
    return this.status === TransferStatus.PENDING;
  }

  isInTransit(): boolean {
    return this.status === TransferStatus.IN_TRANSIT;
  }

  belongsToConductor(conductorId: string): boolean {
    return this.conductorId === conductorId;
  }

  start(): Transfer {
    return new Transfer({
      ...this,
      status: TransferStatus.IN_TRANSIT,
      startedAt: new Date(),
    });
  }

  finish(): Transfer {
    return new Transfer({
      ...this,
      status: TransferStatus.COMPLETED,
      finishedAt: new Date(),
    });
  }
}
