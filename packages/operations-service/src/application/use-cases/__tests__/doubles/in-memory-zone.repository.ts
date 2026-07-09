import type { Zone } from '../../../../domain/entities/zone.entity';
import type { IZoneRepository } from '../../../../domain/ports/zone.repository.port';

export class InMemoryZoneRepository implements IZoneRepository {
  private zones: Zone[] = [];

  seed(zones: Zone[]): void {
    this.zones = [...zones];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(): Promise<Zone[]> {
    return [...this.zones];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<Zone | null> {
    return this.zones.find((z) => z.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(zone: Zone): Promise<Zone> {
    this.zones.push(zone);
    return zone;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(zone: Zone): Promise<Zone> {
    const idx = this.zones.findIndex((z) => z.id === zone.id);
    if (idx >= 0) this.zones[idx] = zone;
    return zone;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(id: string): Promise<void> {
    this.zones = this.zones.filter((z) => z.id !== id);
  }
}
