import { injectable, inject } from 'inversify';

import {
  DuplicateProductNameError,
  ProductNotFoundError,
  ProductOwnershipError,
} from '../../../domain/errors/company.errors';
import type { ICompanyProductRepository } from '../../../domain/ports/company-product.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface UpdateCompanyProductInput {
  readonly firebaseUid: string;
  readonly productId: string;
  readonly name?: string;
  readonly categoryId?: string;
}

export interface UpdateCompanyProductOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly categoryId: string;
  readonly createdAt: Date;
}

@injectable()
export class UpdateCompanyProductUseCase {
  constructor(
    @inject(TYPES.CompanyProductRepository)
    private readonly productRepo: ICompanyProductRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateCompanyProductInput): Promise<UpdateCompanyProductOutput> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const product = await this.productRepo.findById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);

    if (product.clientId !== user.id) throw new ProductOwnershipError();

    if (input.name && input.name !== product.name) {
      const existing = await this.productRepo.findByClientIdAndName(user.id, input.name);
      if (existing) throw new DuplicateProductNameError(input.name);
    }

    let updated = product;
    if (input.name) updated = updated.withName(input.name);
    if (input.categoryId) updated = updated.withCategoryId(input.categoryId);

    const saved = await this.productRepo.update(updated);

    return {
      id: saved.id,
      clientId: saved.clientId,
      name: saved.name,
      categoryId: saved.categoryId,
      createdAt: saved.createdAt,
    };
  }
}
