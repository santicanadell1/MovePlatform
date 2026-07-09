import { inject, injectable } from 'inversify';
import { Request, Response } from 'express';

import { ReceiveGpsPointUseCase } from '../../application/use-cases/receive-gps-point.use-case';
import { TYPES } from '../../types';
import { gpsPointSchema } from '../dtos/gps.dto';

@injectable()
export class GpsController {
  constructor(
    @inject(TYPES.ReceiveGpsPointUseCase) private readonly receiveGpsPoint: ReceiveGpsPointUseCase,
  ) {}

  async receive(req: Request, res: Response): Promise<void> {
    const parsed = gpsPointSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    await this.receiveGpsPoint.execute(parsed.data);
    res.status(202).json({ message: 'GPS point enqueued' });
  }
}
