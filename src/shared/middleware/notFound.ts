import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

/** Catch-all for unmatched routes, placed after every real router. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}
