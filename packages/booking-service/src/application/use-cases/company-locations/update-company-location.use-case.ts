import { injectable, inject } from 'inversify';

import {
  DuplicateLocationNameError,
  LocationNotFoundError,
  LocationOwnershipError,
} from '../../../domain/errors/company.errors';
import type { ICompanyLocationRepository } from '../../../domain/ports/company-location.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface UpdateCompanyLocationInput {
  readonly firebaseUid: string;
  readonly locationId: string;
  readonly name?: string;
  readonly address?: string;
  readonly lat?: number;
  readonly lng?: number;
}

export interface UpdateCompanyLocationOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date;
}

@injectable()
export class UpdateCompanyLocationUseCase {
  constructor(
    @inject(TYPES.CompanyLocationRepository)
    private readonly locationRepo: ICompanyLocationRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateCompanyLocationInput): Promise<UpdateCompanyLocationOutput> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const location = await this.locationRepo.findById(input.locationId);
    if (!location) throw new LocationNotFoundError(input.locationId);

    if (location.clientId !== user.id) throw new LocationOwnershipError();

    if (input.name && input.name !== location.name) {
      const existing = await this.locationRepo.findByClientIdAndName(user.id, input.name);
      if (existing) throw new DuplicateLocationNameError(input.name);
    }

    let updated = location;
    if (input.name) updated = updated.withName(input.name);
    if (input.address !== undefined || input.lat !== undefined || input.lng !== undefined) {
      updated = updated.withAddress(
        input.address ?? updated.address,
        input.lat ?? updated.lat,
        input.lng ?? updated.lng,
      );
    }

    const saved = await this.locationRepo.update(updated);

    return {
      id: saved.id,
      clientId: saved.clientId,
      name: saved.name,
      address: saved.address,
      lat: saved.lat,
      lng: saved.lng,
      createdAt: saved.createdAt,
    };
  }
}
