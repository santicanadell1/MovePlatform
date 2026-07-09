import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole, type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { ZoneController } from '../controllers/zone.controller';

export const createZoneRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<ZoneController>(TYPES.ZoneController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyAdmin = authorize(UserRole.ADMIN);

  router.get('/', auth, onlyAdmin, ctrl.list);
  router.post('/', auth, onlyAdmin, ctrl.create);
  router.put('/:zoneId', auth, onlyAdmin, ctrl.update);
  router.delete('/:zoneId', auth, onlyAdmin, ctrl.delete);

  return router;
};
