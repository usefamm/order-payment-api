import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Part = 'body' | 'params' | 'query';

/**
 * Validates and replaces one part of the request with the parsed (and coerced)
 * result of the given schema. A ZodError thrown here is turned into a 400 by
 * the central error handler.
 */
export function validate<S extends ZodTypeAny>(
  schema: S,
  part: Part = 'body',
): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(_req[part]) as z.infer<S>;
    // `req.query` and `req.params` are getter-only in newer Express, so redefine.
    Object.defineProperty(_req, part, { value: parsed, writable: true });
    next();
  };
}
