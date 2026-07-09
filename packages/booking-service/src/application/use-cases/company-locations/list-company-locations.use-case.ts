import { injectable, inject } from 'inversify';

import type { ICompanyLocationRepository } from '../../../domain/ports/company-location.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface ListCompanyLocationsOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date;
}

@injectable()
export class ListCompanyLocationsUseCase {
  constructor(
    @inject(TYPES.CompanyLocationRepository)
    private readonly locationRepo: ICompanyLocationRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(firebaseUid: string): Promise<ListCompanyLocationsOutput[]> {
    const user = await this.userRepo.findByFirebaseUid(firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const locations = await this.locationRepo.findByClientId(user.id);

    return locations.map((l) => ({
      id: l.id,
      clientId: l.clientId,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lng: l.lng,
      createdAt: l.createdAt,
    }));
  }
}
