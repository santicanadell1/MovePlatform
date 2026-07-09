import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole, type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { UserController } from '../controllers/user.controller';

export const createUserRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<UserController>(TYPES.UserController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyAdmin = authorize(UserRole.ADMIN);

  router.get('/', auth, onlyAdmin, ctrl.list);
  router.put('/:id/status', auth, onlyAdmin, ctrl.updateStatus);

  return router;
};
