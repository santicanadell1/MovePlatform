import { createAuthMiddleware, authorize, IAuthVerifier, UserRole } from '@move/shared';
import { Router } from 'express';
import { Container } from 'inversify';

import { TYPES } from '../../types';
import { GpsController } from '../controllers/gps.controller';

export function createGpsRouter(container: Container): Router {
  const router = Router();
  const controller = container.get<GpsController>(TYPES.GpsController);
  const authVerifier = container.get<IAuthVerifier>(TYPES.AuthService);

  const authMiddleware = createAuthMiddleware(authVerifier);
  const conductorOnly = authorize(UserRole.CONDUCTOR);

  router.post('/', authMiddleware, conductorOnly, (req, res) => controller.receive(req, res));

  return router;
}
