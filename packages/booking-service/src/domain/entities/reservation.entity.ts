import { ReservationStatus } from '@move/shared';

import type { Good } from './good.entity';

export interface CostBreakdown {
  readonly goods: ReadonlyArray<{
    readonly categoryId: string;
    readonly quantity: number;
    readonly baseRate: number;
    readonly ratePerKm: number;
    readonly distanceKm: number;
    readonly surchargePercent: number;
    readonly goodCost: number;
  }>;
  readonly totalCost: number;
}

export interface ReservationProps {
  readonly id: string;
  readonly clientId: string;
  readonly origin: string;
  readonly destination: string;
  readonly originLat: number;
  readonly originLng: number;
  readonly destinationLat: number;
  readonly destinationLng: number;
  readonly scheduledDate: Date;
  readonly status: ReservationStatus;
  readonly totalCost: number | null;
  readonly costBreakdown: CostBreakdown | null;
  readonly vehicleId: string | null;
  readonly conductorId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly goods?: readonly Good[];
}

export class Reservation {
  readonly id: string;
  readonly clientId: string;
  readonly origin: string;
  readonly destination: string;
  readonly originLat: number;
  readonly originLng: number;
  readonly destinationLat: number;
  readonly destinationLng: number;
  readonly scheduledDate: Date;
  readonly status: ReservationStatus;
  readonly totalCost: number | null;
  readonly costBreakdown: CostBreakdown | null;
  readonly vehicleId: string | null;
  readonly conductorId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly goods?: readonly Good[];

  private constructor(props: ReservationProps) {
    this.id = props.id;
    this.clientId = props.clientId;
    this.origin = props.origin;
    this.destination = props.destination;
    this.originLat = props.originLat;
    this.originLng = props.originLng;
    this.destinationLat = props.destinationLat;
    this.destinationLng = props.destinationLng;
    this.scheduledDate = props.scheduledDate;
    this.status = props.status;
    this.totalCost = props.totalCost;
    this.costBreakdown = props.costBreakdown;
    this.vehicleId = props.vehicleId;
    this.conductorId = props.conductorId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.goods = props.goods;
  }

  static create(props: ReservationProps): Reservation {
    return new Reservation(props);
  }

  withStatus(status: ReservationStatus): Reservation {
    return Reservation.create({ ...this, status });
  }

  withQuote(totalCost: number, costBreakdown: CostBreakdown): Reservation {
    return Reservation.create({
      ...this,
      status: ReservationStatus.QUOTED,
      totalCost,
      costBreakdown,
    });
  }
}
