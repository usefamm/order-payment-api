import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { createPaymentSchema, paymentCallbackSchema } from './payment.schema';
import { createPaymentController, paymentCallbackController } from './payment.controller';

const router = Router();

// Provider callbacks are open (secured by the provider reference) and must be
// declared before the auth-gated routes so they don't inherit requireAuth().
router.post('/callback', validate(paymentCallbackSchema), paymentCallbackController);

router.post('/', requireAuth(), validate(createPaymentSchema), createPaymentController);

export default router;
