import { Schema, model, Types } from 'mongoose';

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'paid', 'cancelled', 'failed'];

export interface IOrderItem {
  productId: Types.ObjectId;
  // Snapshots taken at creation time: later edits to the Product (price, name,
  // deactivation) must never rewrite an existing order.
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface IOrder {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: IOrderItem[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    totalPrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
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

// "My orders" listing + admin dashboards both filter by status and sort by date.
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = model<IOrder>('Order', orderSchema);
