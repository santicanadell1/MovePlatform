export interface ActiveAlertData {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly lat: number;
  readonly lng: number;
}

export interface ActiveTransferData {
  readonly id: string;
  readonly reservationId: string;
  readonly origin: string;
  readonly destination: string;
  readonly status: string;
  readonly vehicle: { readonly id: string; readonly plate: string };
  readonly conductor: { readonly id: string; readonly name: string };
  readonly activeAlerts: readonly ActiveAlertData[];
  readonly createdAt: Date;
}

export interface ActiveTransferFilters {
  readonly status?: string;
  readonly vehicleId?: string;
  readonly conductorId?: string;
  readonly categoryId?: string;
  readonly hasAlerts?: boolean;
}

export interface ActiveTransferPage {
  readonly items: readonly ActiveTransferData[];
  readonly nextCursor: string | null;
}

export interface IActiveTransfersRepository {
  findPage(
    filters: ActiveTransferFilters,
    limit: number,
    cursor: string | null,
  ): Promise<ActiveTransferPage>;
}
