import { randomUUID } from 'node:crypto';

import { injectable, inject } from 'inversify';

import { CompanyLocation } from '../../../domain/entities/company-location.entity';
import { DuplicateLocationNameError } from '../../../domain/errors/company.errors';
import type { ICompanyLocationRepository } from '../../../domain/ports/company-location.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface CreateCompanyLocationInput {
  readonly firebaseUid: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
}

export interface CreateCompanyLocationOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly createdAt: Date;
}

@injectable()
export class CreateCompanyLocationUseCase {
  constructor(
    @inject(TYPES.CompanyLocationRepository)
    private readonly locationRepo: ICompanyLocationRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: CreateCompanyLocationInput): Promise<CreateCompanyLocationOutput> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const existing = await this.locationRepo.findByClientIdAndName(user.id, input.name);
    if (existing) throw new DuplicateLocationNameError(input.name);

    const now = new Date();
    const location = CompanyLocation.create({
      id: randomUUID(),
      clientId: user.id,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.locationRepo.create(location);

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
