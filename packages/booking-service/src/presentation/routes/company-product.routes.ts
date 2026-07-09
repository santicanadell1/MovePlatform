import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole } from '@move/shared';
import { type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { CompanyProductController } from '../controllers/company-product.controller';

export const createCompanyProductRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<CompanyProductController>(TYPES.CompanyProductController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyEmpresa = authorize(UserRole.CLIENT_EMPRESA);

  router.post('/', auth, onlyEmpresa, ctrl.create);
  router.get('/', auth, onlyEmpresa, ctrl.list);
  router.patch('/:productId', auth, onlyEmpresa, ctrl.update);
  router.delete('/:productId', auth, onlyEmpresa, ctrl.delete);

  return router;
};
