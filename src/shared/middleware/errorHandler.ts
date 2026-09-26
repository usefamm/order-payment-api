import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/codes';

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

/**
 * Central error handler. Normalises every thrown value into the agreed
 * { success:false, message, code } envelope and makes sure internal details or
 * stack traces never reach the client.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const body = toErrorBody(err);

  // Log the raw error server-side for debugging; the client only sees `body`.
  if (body.code === ErrorCodes.INTERNAL_ERROR) {
    // eslint-disable-next-line no-console
    console.error('[unhandled]', err);
  }

  const status = err instanceof AppError ? err.statusCode : statusFor(body.code);
  res.status(status).json(body);
}

function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof AppError) {
    return {
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }

  if (err instanceof ZodError) {
    return {
      success: false,
      message: 'Invalid request payload',
      code: ErrorCodes.VALIDATION_ERROR,
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { success: false, message: 'Invalid identifier format', code: ErrorCodes.VALIDATION_ERROR };
  }

  if (isDuplicateKeyError(err)) {
    return { success: false, message: 'Resource already exists', code: ErrorCodes.DUPLICATE_RESOURCE };
  }

  // Anything else is a bug: return a generic message outside of development.
  const message =
    config.env === 'development' && err instanceof Error ? err.message : 'Something went wrong';
  return { success: false, message, code: ErrorCodes.INTERNAL_ERROR };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

function statusFor(code: string): number {
  switch (code) {
    case ErrorCodes.VALIDATION_ERROR:
      return 400;
    case ErrorCodes.UNAUTHORIZED:
    case ErrorCodes.INVALID_CREDENTIALS:
      return 401;
    case ErrorCodes.FORBIDDEN:
      return 403;
    case ErrorCodes.NOT_FOUND:
    case ErrorCodes.PAYMENT_NOT_FOUND:
      return 404;
    case ErrorCodes.DUPLICATE_RESOURCE:
    case ErrorCodes.INSUFFICIENT_STOCK:
    case ErrorCodes.PRODUCT_NOT_ACTIVE:
    case ErrorCodes.ORDER_NOT_PAYABLE:
    case ErrorCodes.PAYMENT_AMOUNT_MISMATCH:
    case ErrorCodes.IDEMPOTENCY_CONFLICT:
      return 409;
    default:
      return 500;
  }
}
