import { injectable, inject } from 'inversify';

import {
  LocationNotFoundError,
  LocationOwnershipError,
} from '../../../domain/errors/company.errors';
import type { ICompanyLocationRepository } from '../../../domain/ports/company-location.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface DeleteCompanyLocationInput {
  readonly firebaseUid: string;
  readonly locationId: string;
}

@injectable()
export class DeleteCompanyLocationUseCase {
  constructor(
    @inject(TYPES.CompanyLocationRepository)
    private readonly locationRepo: ICompanyLocationRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: DeleteCompanyLocationInput): Promise<void> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const location = await this.locationRepo.findById(input.locationId);
    if (!location) throw new LocationNotFoundError(input.locationId);

    if (location.clientId !== user.id) throw new LocationOwnershipError();

    await this.locationRepo.delete(input.locationId);
  }
}
