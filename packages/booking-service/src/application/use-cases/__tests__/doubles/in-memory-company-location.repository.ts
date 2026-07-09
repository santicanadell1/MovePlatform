import type { CompanyLocation } from '../../../../domain/entities/company-location.entity';
import type { ICompanyLocationRepository } from '../../../../domain/ports/company-location.repository.port';

export class InMemoryCompanyLocationRepository implements ICompanyLocationRepository {
  private locations: CompanyLocation[] = [];

  seed(locations: CompanyLocation[]): void {
    this.locations = [...locations];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(id: string): Promise<CompanyLocation | null> {
    return this.locations.find((l) => l.id === id) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByClientId(clientId: string): Promise<CompanyLocation[]> {
    return this.locations.filter((l) => l.clientId === clientId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByClientIdAndName(clientId: string, name: string): Promise<CompanyLocation | null> {
    return this.locations.find((l) => l.clientId === clientId && l.name === name) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async create(location: CompanyLocation): Promise<CompanyLocation> {
    this.locations.push(location);
    return location;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async update(location: CompanyLocation): Promise<CompanyLocation> {
    const idx = this.locations.findIndex((l) => l.id === location.id);
    if (idx >= 0) this.locations[idx] = location;
    return location;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(id: string): Promise<void> {
    this.locations = this.locations.filter((l) => l.id !== id);
  }
}
