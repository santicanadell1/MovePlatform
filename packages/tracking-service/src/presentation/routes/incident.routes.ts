import { createAuthMiddleware, authorize, IAuthVerifier, UserRole } from '@move/shared';
import { Router } from 'express';
import { Container } from 'inversify';

import { TYPES } from '../../types';
import { IncidentController } from '../controllers/incident.controller';

export function createIncidentRouter(container: Container): Router {
  const router = Router({ mergeParams: true });
  const controller = container.get<IncidentController>(TYPES.IncidentController);
  const authVerifier = container.get<IAuthVerifier>(TYPES.AuthService);

  const authMiddleware = createAuthMiddleware(authVerifier);
  const conductorOnly = authorize(UserRole.CONDUCTOR);

  router.post('/', authMiddleware, conductorOnly, (req, res) => controller.report(req, res));
  router.get('/', authMiddleware, conductorOnly, (req, res) => controller.list(req, res));

  return router;
}
