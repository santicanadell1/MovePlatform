import { Incident } from '../../domain/entities/incident.entity';

export interface IIncidentRepository {
  save(incident: Incident): Promise<Incident>;
  findByTransferId(transferId: string): Promise<Incident[]>;
}
