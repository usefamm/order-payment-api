import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/objectId';

export const createPaymentSchema = z.object({
  orderId: objectIdSchema,
  // Amount is accepted for the interface but never trusted: the service
  // recomputes it from the order and rejects any mismatch.
  amount: z.number().int().nonnegative().optional(),
});

export const paymentCallbackSchema = z.object({
  paymentRef: z.string().min(1),
  status: z.enum(['succeeded', 'failed']),
  // A signature would be verified here in a real integration.
  signature: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentCallbackInput = z.infer<typeof paymentCallbackSchema>;
