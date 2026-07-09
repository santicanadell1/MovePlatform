import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole } from '@move/shared';
import type { IAuthVerifier } from '@move/shared';

import { TYPES } from '../../types';
import type { ReservationController } from '../controllers/reservation.controller';

export const createReservationRouter = (container: Container): Router => {
  const router = Router();
  const ctrl = container.get<ReservationController>(TYPES.ReservationController);
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyClient = authorize(UserRole.CLIENT_PARTICULAR, UserRole.CLIENT_EMPRESA);
  const onlyClientOrOperator = authorize(
    UserRole.CLIENT_PARTICULAR,
    UserRole.CLIENT_EMPRESA,
    UserRole.OPERATOR,
    UserRole.ADMIN,
  );
  const onlyOperator = authorize(UserRole.OPERATOR, UserRole.ADMIN);

  router.get('/notifications/stream', auth, onlyOperator, ctrl.streamNotifications);
  router.get('/', auth, onlyClientOrOperator, ctrl.list);
  router.post('/', auth, onlyClient, ctrl.create);
  router.post('/:id/pagar', auth, onlyClient, ctrl.pay);
  router.post('/:id/clasificar', auth, onlyOperator, ctrl.classify);
  router.post('/:id/rechazar', auth, onlyOperator, ctrl.reject);

  return router;
};
