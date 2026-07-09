import { createAuthMiddleware, authorize, IAuthVerifier, UserRole } from '@move/shared';
import { Router } from 'express';
import { Container } from 'inversify';

import { TYPES } from '../../types';
import { TransferController } from '../controllers/transfer.controller';

export function createTransferRouter(container: Container): Router {
  const router = Router();
  const controller = container.get<TransferController>(TYPES.TransferController);
  const authVerifier = container.get<IAuthVerifier>(TYPES.AuthService);

  const authMiddleware = createAuthMiddleware(authVerifier);
  const conductorOnly = authorize(UserRole.CONDUCTOR);

  router.post(
    '/:reservationId/iniciar',
    authMiddleware,
    conductorOnly,
    (req, res) => controller.start(req, res),
  );

  router.post(
    '/:reservationId/finalizar',
    authMiddleware,
    conductorOnly,
    (req, res) => controller.finish(req, res),
  );

  return router;
}
