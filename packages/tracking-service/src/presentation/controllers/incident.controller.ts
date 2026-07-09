import { inject, injectable } from 'inversify';
import { Request, Response } from 'express';

import { GetIncidentsByTransferUseCase } from '../../application/use-cases/get-incidents-by-transfer.use-case';
import { ReportIncidentUseCase } from '../../application/use-cases/report-incident.use-case';
import {
  IncidentConductorMismatchError,
  IncidentTransferNotFoundError,
  IncidentTransferNotInTransitError,
} from '../../domain/errors/incident.errors';
import { TYPES } from '../../types';
import { reportIncidentSchema } from '../dtos/incident.dto';

@injectable()
export class IncidentController {
  constructor(
    @inject(TYPES.ReportIncidentUseCase) private readonly reportIncident: ReportIncidentUseCase,
    @inject(TYPES.GetIncidentsByTransferUseCase) private readonly getIncidents: GetIncidentsByTransferUseCase,
  ) {}

  async report(req: Request, res: Response): Promise<void> {
    const parsed = reportIncidentSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await this.reportIncident.execute({
        reservationId: String(req.params.reservationId),
        conductorId: req.user?.uid ?? '',
        description: parsed.data.description,
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof IncidentTransferNotFoundError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof IncidentConductorMismatchError) {
        res.status(403).json({ error: error.message });
      } else if (error instanceof IncidentTransferNotInTransitError) {
        res.status(409).json({ error: error.message });
      } else {
        throw error;
      }
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    const incidents = await this.getIncidents.execute(String(req.params.reservationId));
    res.status(200).json(incidents);
  }
}
