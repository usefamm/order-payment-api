/**
 * Stable, machine-readable error codes returned to clients. Keeping these in one
 * place means the frontend (or a partner integration) can branch on `code`
 * instead of parsing human-readable messages.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  PRODUCT_NOT_ACTIVE: 'PRODUCT_NOT_ACTIVE',
  ORDER_NOT_PAYABLE: 'ORDER_NOT_PAYABLE',
  PAYMENT_AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
