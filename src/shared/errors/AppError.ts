import { ErrorCode, ErrorCodes } from './codes';

/**
 * Operational error we intentionally surface to the client. Anything that is not
 * an AppError is treated as a bug and reported as a generic 500 by the central
 * handler, so internal details never leak.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, AppError);
  }

  static badRequest(message: string, code: ErrorCode = ErrorCodes.VALIDATION_ERROR, details?: unknown) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code: ErrorCode = ErrorCodes.UNAUTHORIZED) {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Not allowed to perform this action') {
    return new AppError(403, ErrorCodes.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found', code: ErrorCode = ErrorCodes.NOT_FOUND) {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code: ErrorCode = ErrorCodes.DUPLICATE_RESOURCE) {
    return new AppError(409, code, message);
  }

  static internal(message = 'Something went wrong', details?: unknown) {
    return new AppError(500, ErrorCodes.INTERNAL_ERROR, message, details);
  }
}
