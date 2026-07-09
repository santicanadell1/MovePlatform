import { randomUUID } from 'node:crypto';

import { injectable, inject } from 'inversify';

import { CompanyProduct } from '../../../domain/entities/company-product.entity';
import { DuplicateProductNameError } from '../../../domain/errors/company.errors';
import type { ICompanyProductRepository } from '../../../domain/ports/company-product.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface CreateCompanyProductInput {
  readonly firebaseUid: string;
  readonly name: string;
  readonly categoryId: string;
}

export interface CreateCompanyProductOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly categoryId: string;
  readonly createdAt: Date;
}

@injectable()
export class CreateCompanyProductUseCase {
  constructor(
    @inject(TYPES.CompanyProductRepository)
    private readonly productRepo: ICompanyProductRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: CreateCompanyProductInput): Promise<CreateCompanyProductOutput> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const existing = await this.productRepo.findByClientIdAndName(user.id, input.name);
    if (existing) throw new DuplicateProductNameError(input.name);

    const now = new Date();
    const product = CompanyProduct.create({
      id: randomUUID(),
      clientId: user.id,
      name: input.name,
      categoryId: input.categoryId,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.productRepo.create(product);

    return {
      id: saved.id,
      clientId: saved.clientId,
      name: saved.name,
      categoryId: saved.categoryId,
      createdAt: saved.createdAt,
    };
  }
}
