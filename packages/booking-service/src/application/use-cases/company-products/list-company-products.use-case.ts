import { injectable, inject } from 'inversify';

import type { ICompanyProductRepository } from '../../../domain/ports/company-product.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { TYPES } from '../../../types';

export interface ListCompanyProductsOutput {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly categoryId: string;
  readonly createdAt: Date;
}

@injectable()
export class ListCompanyProductsUseCase {
  constructor(
    @inject(TYPES.CompanyProductRepository)
    private readonly productRepo: ICompanyProductRepository,
    @inject(TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(firebaseUid: string): Promise<ListCompanyProductsOutput[]> {
    const user = await this.userRepo.findByFirebaseUid(firebaseUid);
    if (!user) throw new Error('Usuario no encontrado');

    const products = await this.productRepo.findByClientId(user.id);

    return products.map((p) => ({
      id: p.id,
      clientId: p.clientId,
      name: p.name,
      categoryId: p.categoryId,
      createdAt: p.createdAt,
    }));
  }
}
