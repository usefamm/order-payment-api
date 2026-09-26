import { z } from 'zod';
import { objectIdSchema } from '../../shared/validation/objectId';

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  // Integer smallest-unit price; reject decimals and negatives outright.
  price: z.number().int().positive(),
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const productIdParamSchema = z.object({
  id: objectIdSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
