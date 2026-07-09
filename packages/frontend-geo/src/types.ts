export type ZoneType = 'RED' | 'PREFERRED';

export interface ZoneOutput {
  readonly id: string;
  readonly name: string;
  readonly type: ZoneType;
  readonly geom: {
    readonly type: 'Polygon';
    readonly coordinates: number[][][];
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ZonesApiResponse {
  readonly data: ZoneOutput[];
  readonly error: null;
}

export interface TransferAlertOutput {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly lat: number;
  readonly lng: number;
}

export interface TransferOutput {
  readonly id: string;
  readonly reservationId: string;
  readonly origin: string;
  readonly destination: string;
  readonly status: string;
  readonly vehicle: { readonly id: string; readonly plate: string };
  readonly conductor: { readonly id: string; readonly name: string };
  readonly activeAlerts: readonly TransferAlertOutput[];
}

export interface TransfersApiResponse {
  readonly data: {
    readonly items: readonly TransferOutput[];
    readonly nextCursor: string | null;
  };
  readonly error: null;
}
