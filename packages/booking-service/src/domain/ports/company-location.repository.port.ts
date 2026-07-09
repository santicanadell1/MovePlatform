import type { CompanyLocation } from '../entities/company-location.entity';

export interface ICompanyLocationRepository {
  findById(id: string): Promise<CompanyLocation | null>;
  findByClientId(clientId: string): Promise<CompanyLocation[]>;
  findByClientIdAndName(clientId: string, name: string): Promise<CompanyLocation | null>;
  create(location: CompanyLocation): Promise<CompanyLocation>;
  update(location: CompanyLocation): Promise<CompanyLocation>;
  delete(id: string): Promise<void>;
}
