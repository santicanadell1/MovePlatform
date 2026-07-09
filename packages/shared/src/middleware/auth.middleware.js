'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.authorize = exports.createAuthMiddleware = void 0;
const createAuthMiddleware = (verifier) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autorización requerido' });
      return;
    }
    const token = authHeader.slice(7);
    try {
      req.user = await verifier.verifyToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Token inválido o expirado' });
    }
  };
};
exports.createAuthMiddleware = createAuthMiddleware;
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permisos insuficientes' });
      return;
    }
    next();
  };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.middleware.js.map
