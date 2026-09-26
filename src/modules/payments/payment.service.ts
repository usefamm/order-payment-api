import { randomBytes } from 'crypto';
import { Payment, type IPayment } from '../../models/payment.model';
import { Order } from '../../models/order.model';
import { Product } from '../../models/product.model';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/codes';
import type { CreatePaymentInput, PaymentCallbackInput } from './payment.schema';

function providerRef(): string {
  return `prov_${randomBytes(12).toString('hex')}`;
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

export async function createPayment(
  userId: string,
  input: CreatePaymentInput,
  idempotencyKey?: string,
): Promise<IPayment> {
  const order = await Order.findById(input.orderId);
  if (!order) throw AppError.notFound('Order not found');
  if (order.userId.toString() !== userId) throw AppError.forbidden('Not your order');
  if (order.status !== 'pending') {
    throw AppError.conflict(`Order is ${order.status} and cannot be paid`, ErrorCodes.ORDER_NOT_PAYABLE);
  }

  // Authoritative amount always comes from the stored order total. A client
  // that sends anything else (e.g. 100,000 for a 2,000,000 order) is rejected.
  if (input.amount !== undefined && input.amount !== order.totalPrice) {
    throw AppError.badRequest(
      'Payment amount does not match the order total',
      ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
    );
  }

  // Reuse any payment already created for this idempotency key: a retried
  // POST must not open a second charge.
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  try {
    return await Payment.create({
      orderId: order._id,
      userId,
      amount: order.totalPrice,
      status: 'pending',
      providerRef: providerRef(),
      idempotencyKey,
    });
  } catch (err) {
    // Lost a race against an identical key: the unique index kept one document,
    // return that winner instead of creating a duplicate.
    if (idempotencyKey && isDuplicateKey(err)) {
      const winner = await Payment.findOne({ idempotencyKey });
      if (winner) return winner;
    }
    throw err;
  }
}

export async function handleCallback(
  input: PaymentCallbackInput,
): Promise<{ processed: boolean; paymentId: string }> {
  const payment = await Payment.findOne({ providerRef: input.paymentRef });
  if (!payment) throw AppError.notFound('Payment not found', ErrorCodes.PAYMENT_NOT_FOUND);

  // Idempotency gate: move the payment out of `pending` exactly once. Only the
  // request whose atomic update actually matches continues below; every later
  // duplicate callback finds a non-pending payment and no-ops.
  const won = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'pending' },
    { status: input.status, processedAt: new Date() },
    { new: true },
  );
  if (!won) {
    return { processed: false, paymentId: payment._id.toString() };
  }

  if (input.status === 'succeeded') {
    // Stock was already reserved at order creation, so confirming payment only
    // flips the order pending -> paid (also guarded, so it happens once).
    await Order.findOneAndUpdate({ _id: payment.orderId, status: 'pending' }, { status: 'paid' });
  } else {
    // Payment failed: release the reserved stock, but only for the request that
    // wins the pending -> failed transition, so stock is returned exactly once.
    const order = await Order.findOneAndUpdate(
      { _id: payment.orderId, status: 'pending' },
      { status: 'failed' },
      { new: true },
    );
    if (order) {
      await Promise.all(
        order.items.map((item) =>
          Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } }),
        ),
      );
    }
  }

  return { processed: true, paymentId: payment._id.toString() };
}
