import { Router } from 'express';
import type { Container } from 'inversify';
import { type IAuthVerifier, createAuthMiddleware, authorize, UserRole } from '@move/shared';

import { TYPES } from '../../types';
import type { CompanyLocationController } from '../controllers/company-location.controller';

export const createCompanyLocationRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<CompanyLocationController>(TYPES.CompanyLocationController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyEmpresa = authorize(UserRole.CLIENT_EMPRESA);

  router.post('/', auth, onlyEmpresa, ctrl.create);
  router.get('/', auth, onlyEmpresa, ctrl.list);
  router.patch('/:locationId', auth, onlyEmpresa, ctrl.update);
  router.delete('/:locationId', auth, onlyEmpresa, ctrl.delete);

  return router;
};
