import { Schema, model, Types } from 'mongoose';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'succeeded', 'failed'];

export interface IPayment {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  status: PaymentStatus;
  // Reference the fake provider hands back; callbacks come in keyed by this.
  providerRef: string;
  // Client-supplied key that makes POST /payments safe to retry.
  idempotencyKey?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    providerRef: { type: String, required: true, unique: true },
    // Sparse so payments created without a key don't collide on null.
    idempotencyKey: { type: String, unique: true, sparse: true },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Fetch the payment(s) for a given order when creating/verifying payment.
paymentSchema.index({ orderId: 1, status: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
