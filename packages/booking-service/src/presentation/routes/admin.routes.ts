import { Router } from 'express';
import type { Container } from 'inversify';
import { createAuthMiddleware, authorize, UserRole } from '@move/shared';
import type { IAuthVerifier } from '@move/shared';

import { PricingService } from '../../application/services/pricing.service';
import { logger } from '../../infrastructure/logger';
import { TYPES } from '../../types';

export const createAdminRouter = (container: Container): Router => {
  const router = Router();
  const verifier = container.get<IAuthVerifier>(TYPES.AuthVerifier);
  const auth = createAuthMiddleware(verifier);
  const onlyAdmin = authorize(UserRole.ADMIN);

  router.post('/pricing/reload', auth, onlyAdmin, (_req, res) => {
    const pricing = container.get<PricingService>(TYPES.PricingService);
    pricing
      .reload()
      .then(() => {
        const reloadedAt = new Date().toISOString();
        logger.info('Pricing rules reloaded', { reloadedAt });
        res.json({ data: { reloadedAt }, error: null });
      })
      .catch((err: unknown) => {
        logger.error('Error reloading pricing rules', { err });
        res.status(500).json({
          data: null,
          error: { code: 'RELOAD_FAILED', message: 'Error al recargar reglas' },
        });
      });
  });

  return router;
};
