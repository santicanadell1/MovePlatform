import { ZoneMatch } from '../../domain/value-objects/zone-match.vo';

export interface IZoneRepository {
  findContaining(lat: number, lng: number): Promise<ZoneMatch | null>;
}
