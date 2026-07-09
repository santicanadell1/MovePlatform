import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole, type IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { VehicleController } from '../controllers/vehicle.controller';

export const createVehicleRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<VehicleController>(TYPES.VehicleController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyAdmin = authorize(UserRole.ADMIN);

  router.get('/', auth, onlyAdmin, ctrl.list);
  router.post('/', auth, onlyAdmin, ctrl.create);
  router.put('/:vehicleId', auth, onlyAdmin, ctrl.update);

  return router;
};
