import { Router } from 'express';
import type { Container } from 'inversify';

import { TYPES } from '../../types';
import type { AuthController } from '../controllers/auth.controller';

export const createAuthRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<AuthController>(TYPES.AuthController);

  router.post('/register', ctrl.register);
  router.post('/login', ctrl.login);

  return router;
};
