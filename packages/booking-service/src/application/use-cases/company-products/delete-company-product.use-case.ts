import { injectable, inject } from 'inversify';

import { ProductNotFoundError, ProductOwnershipError } from '../../../domain/errors/company.errors';
import type { ICompanyProductRepository } from '../../../domain/ports/company-product.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface DeleteCompanyProductInput {
  readonly firebaseUid: string;
  readonly productId: string;
}

@injectable()
export class DeleteCompanyProductUseCase {
  constructor(
    @inject(TYPES.CompanyProductRepository)
    private readonly productRepo: ICompanyProductRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: DeleteCompanyProductInput): Promise<void> {
    const user = await this.userRepo.findByFirebaseUid(input.firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const product = await this.productRepo.findById(input.productId);
    if (!product) throw new ProductNotFoundError(input.productId);

    if (product.clientId !== user.id) throw new ProductOwnershipError();

    await this.productRepo.delete(input.productId);
  }
}
