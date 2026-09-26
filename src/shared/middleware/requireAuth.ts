import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors/AppError';
import { verifyToken } from '../auth/token';
import { tokenStore } from '../auth/tokenStore';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Requires a valid JWT whose jti is still present in the token store (Redis
 * when configured). Signature alone is not enough: a logged-out token is
 * rejected even though it has not expired. When `roles` is provided the caller
 * must also have one of those roles.
 */
export function requireAuth(roles?: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Async body: any rejection is handed to Express' error pipeline so the
    // central error handler turns it into a proper 401/403 instead of hanging.
    void (async () => {
      const token = extractBearer(req);
      if (!token) {
        throw AppError.unauthorized('Missing bearer token');
      }

      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw AppError.unauthorized('Invalid or expired token');
      }

      // Server-side liveness check — this is what makes logout real.
      if (!(await tokenStore.exists(payload.jti))) {
        throw AppError.unauthorized('Token revoked or expired');
      }

      if (roles && roles.length > 0 && !roles.includes(payload.role)) {
        throw AppError.forbidden('Insufficient role for this operation');
      }

      req.auth = { userId: payload.sub, role: payload.role, jti: payload.jti };
      next();
    })().catch(next);
  };
}
