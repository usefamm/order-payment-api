import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { createOrderSchema, orderIdParamSchema } from './order.schema';
import { createOrderController, getOrderController } from './order.controller';

const router = Router();

// Every order route requires a logged-in user.
router.use(requireAuth());
router.post('/', validate(createOrderSchema), createOrderController);
router.get('/:id', validate(orderIdParamSchema, 'params'), getOrderController);

export default router;
