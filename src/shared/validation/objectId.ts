import { Types } from 'mongoose';
import { z } from 'zod';

/** Reusable zod schema for a well-formed MongoDB ObjectId string. */
export const objectIdSchema = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), {
    message: 'Must be a valid ObjectId',
  });
