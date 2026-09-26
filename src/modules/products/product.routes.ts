import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { createProductSchema, productIdParamSchema } from './product.schema';
import {
  createProductController,
  getProductController,
  listProductsController,
} from './product.controller';

const router = Router();

// Creating catalogue items is an admin-only operation.
router.post(
  '/',
  requireAuth(['admin']),
  validate(createProductSchema),
  createProductController,
);
router.get('/', listProductsController);
router.get('/:id', validate(productIdParamSchema, 'params'), getProductController);

export default router;
