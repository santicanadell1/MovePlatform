import { inject, injectable } from 'inversify';
import { Request, Response } from 'express';

import { StartTransferUseCase } from '../../application/use-cases/start-transfer.use-case';
import { FinishTransferUseCase } from '../../application/use-cases/finish-transfer.use-case';
import {
  ConductorMismatchError,
  TransferNotFoundError,
  TransferNotInTransitError,
  TransferNotPendingError,
  VehicleAlreadyInTransitError,
  VehicleNotRegisteredError,
} from '../../domain/errors/transfer.errors';
import { TYPES } from '../../types';
import { startTransferSchema, finishTransferSchema } from '../dtos/transfer.dto';

@injectable()
export class TransferController {
  constructor(
    @inject(TYPES.StartTransferUseCase) private readonly startTransfer: StartTransferUseCase,
    @inject(TYPES.FinishTransferUseCase) private readonly finishTransfer: FinishTransferUseCase,
  ) {}

  async start(req: Request, res: Response): Promise<void> {
    const parsed = startTransferSchema.safeParse({
      ...req.body,
      reservationId: req.params.reservationId,
      conductorId: req.user?.uid,
    });

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await this.startTransfer.execute(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof VehicleNotRegisteredError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof ConductorMismatchError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof TransferNotPendingError) {
        res.status(409).json({ error: error.message });
      } else if (error instanceof VehicleAlreadyInTransitError) {
        res.status(409).json({ error: error.message });
      } else {
        throw error;
      }
    }
  }

  async finish(req: Request, res: Response): Promise<void> {
    const parsed = finishTransferSchema.safeParse({
      ...req.body,
      reservationId: req.params.reservationId,
      conductorId: req.user?.uid,
    });

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await this.finishTransfer.execute(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ConductorMismatchError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof TransferNotFoundError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof TransferNotInTransitError) {
        res.status(409).json({ error: error.message });
      } else {
        throw error;
      }
    }
  }
}
