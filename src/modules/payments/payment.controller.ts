import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler';
import { sendSuccess } from '../../shared/http/sendSuccess';
import * as paymentService from './payment.service';
import type { CreatePaymentInput, PaymentCallbackInput } from './payment.schema';

export const createPaymentController = asyncHandler(async (req: Request, res: Response) => {
  const key = req.header('Idempotency-Key')?.trim() || undefined;
  const payment = await paymentService.createPayment(
    req.auth!.userId,
    req.body as CreatePaymentInput,
    key,
  );
  sendSuccess(res, payment, 201);
});

// Comes from the payment provider, not a logged-in user: authenticated by the
// provider reference (and, in a real system, a verified signature).
export const paymentCallbackController = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.handleCallback(req.body as PaymentCallbackInput);
  sendSuccess(res, result);
});
