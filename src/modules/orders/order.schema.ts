import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/objectId';

const orderItemSchema = z.object({
  productId: objectIdSchema,
  // quantity must be a positive integer — a tampered/0/negative/float value is
  // rejected here before it can reach the stock logic.
  quantity: z.number().int().positive(),
  // NOTE: there is intentionally no `price` field. Any price the client sends is
  // dropped by .strip() and the authoritative price is read from the Product.
}).strip();

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'An order needs at least one item'),
});

export const orderIdParamSchema = z.object({
  id: objectIdSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
