import type {
  ActiveTransferData,
  ActiveTransferFilters,
  ActiveTransferPage,
  IActiveTransfersRepository,
} from '../../../../domain/ports/active-transfers.repository.port';

export class InMemoryActiveTransfersRepository implements IActiveTransfersRepository {
  private transfers: ActiveTransferData[] = [];

  seed(transfers: ActiveTransferData[]): void {
    this.transfers = [...transfers];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findPage(
    filters: ActiveTransferFilters,
    limit: number,
    cursor: string | null,
  ): Promise<ActiveTransferPage> {
    let items = [...this.transfers];

    if (filters.status !== undefined) {
      items = items.filter((t) => t.status === filters.status);
    }
    if (filters.vehicleId !== undefined) {
      items = items.filter((t) => t.vehicle.id === filters.vehicleId);
    }
    if (filters.conductorId !== undefined) {
      items = items.filter((t) => t.conductor.id === filters.conductorId);
    }
    if (filters.hasAlerts === true) {
      items = items.filter((t) => t.activeAlerts.length > 0);
    } else if (filters.hasAlerts === false) {
      items = items.filter((t) => t.activeAlerts.length === 0);
    }
    // categoryId no se filtra en memoria (requiere JOIN de BD); cubierto por tests de integración

    items.sort((a, b) => {
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      if (diff !== 0) return diff;
      return b.id < a.id ? -1 : 1;
    });

    if (cursor !== null) {
      const { createdAt, id } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as {
        createdAt: string;
        id: string;
      };
      const cursorMs = new Date(createdAt).getTime();
      items = items.filter((t) => {
        const tMs = t.createdAt.getTime();
        return tMs < cursorMs || (tMs === cursorMs && t.id < id);
      });
    }

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && page.length > 0
        ? Buffer.from(
            JSON.stringify({
              createdAt: page[page.length - 1].createdAt.toISOString(),
              id: page[page.length - 1].id,
            }),
          ).toString('base64')
        : null;

    return { items: page, nextCursor };
  }
}
