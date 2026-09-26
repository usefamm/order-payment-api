import bcrypt from 'bcryptjs';
import { Schema, model, Types } from 'mongoose';

export type UserRole = 'customer' | 'admin';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true, // login + dedupe by email; also the lookup path on every sign-in
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    // select:false keeps the hash out of every normal query result by default.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  },
  {
    timestamps: true,
    methods: {
      comparePassword(candidate: string) {
        return bcrypt.compare(candidate, this.password);
      },
    },
  },
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

export const User = model<IUser>('User', userSchema);
