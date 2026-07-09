import type { Zone } from '../entities/zone.entity';

export interface IZoneRepository {
  findAll(): Promise<Zone[]>;
  findById(id: string): Promise<Zone | null>;
  create(zone: Zone): Promise<Zone>;
  update(zone: Zone): Promise<Zone>;
  delete(id: string): Promise<void>;
}
