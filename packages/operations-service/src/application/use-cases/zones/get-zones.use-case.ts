import { injectable, inject } from 'inversify';

import type { GeoJsonPolygon } from '../../../domain/entities/zone.entity';
import type { IZoneRepository } from '../../../domain/ports/zone.repository.port';
import { TYPES } from '../../../types';

export interface ZoneOutput {
  readonly id: string;
  readonly name: string;
  readonly type: 'RED' | 'PREFERRED';
  readonly geom: GeoJsonPolygon;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

@injectable()
export class GetZonesUseCase {
  constructor(
    @inject(TYPES.ZoneRepository)
    private readonly zoneRepo: IZoneRepository,
  ) {}

  async execute(): Promise<ZoneOutput[]> {
    const zones = await this.zoneRepo.findAll();
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      geom: z.geom,
      createdAt: z.createdAt,
      updatedAt: z.updatedAt,
    }));
  }
}
