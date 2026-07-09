import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole, type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { OperationsController } from '../controllers/operations.controller';

export const createOperationsRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<OperationsController>(TYPES.OperationsController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyOperator = authorize(UserRole.OPERATOR);

  router.post('/:reservationId/asignar', auth, onlyOperator, ctrl.assignReservation);

  return router;
};
