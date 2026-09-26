import type { Response } from 'express';

/**
 * Every success response shares the same envelope so clients can rely on a
 * single shape: { success: true, data } .
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}
