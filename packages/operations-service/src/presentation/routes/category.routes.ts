import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole, type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { CategoryController } from '../controllers/category.controller';

export const createCategoryRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<CategoryController>(TYPES.CategoryController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyAdmin = authorize(UserRole.ADMIN);

  router.get('/', auth, onlyAdmin, ctrl.list);
  router.post('/', auth, onlyAdmin, ctrl.create);
  router.put('/:categoryId', auth, onlyAdmin, ctrl.update);
  router.delete('/:categoryId', auth, onlyAdmin, ctrl.delete);

  return router;
};
