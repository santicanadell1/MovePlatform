import { injectable, inject } from 'inversify';

import type {
  ActiveTransferPage,
  IActiveTransfersRepository,
} from '../../../domain/ports/active-transfers.repository.port';
import { TYPES } from '../../../types';

export interface GetActiveTransfersInput {
  readonly status?: string;
  readonly vehicleId?: string;
  readonly conductorId?: string;
  readonly categoryId?: string;
  readonly hasAlerts?: boolean;
  readonly limit: number;
  readonly cursor?: string;
}

@injectable()
export class GetActiveTransfersUseCase {
  constructor(
    @inject(TYPES.ActiveTransfersRepository)
    private readonly repo: IActiveTransfersRepository,
  ) {}

  async execute(input: GetActiveTransfersInput): Promise<ActiveTransferPage> {
    return this.repo.findPage(
      {
        status: input.status,
        vehicleId: input.vehicleId,
        conductorId: input.conductorId,
        categoryId: input.categoryId,
        hasAlerts: input.hasAlerts,
      },
      input.limit,
      input.cursor ?? null,
    );
  }
}
