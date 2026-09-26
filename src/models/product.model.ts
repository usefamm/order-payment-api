import { Schema, model, Types } from 'mongoose';

export interface IProduct {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  // Stored as an integer in the smallest currency unit (e.g. rial) to avoid
  // floating-point rounding bugs in money math.
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    // min:0 is a second line of defence; the atomic $inc guard is the real
    // protection against overselling (see orders.service.ts).
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
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

// Catalog listing filters on active products and sorts newest first.
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ name: 1 });

export const Product = model<IProduct>('Product', productSchema);
