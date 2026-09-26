import { Types } from 'mongoose';
import { createApp } from '../src/app';
import { signToken } from '../src/shared/auth/token';
import { tokenStore, ttlSecondsFrom } from '../src/shared/auth/tokenStore';
import { config } from '../src/config/env';
import { User, type UserRole } from '../src/models/user.model';
import { Product, type IProduct } from '../src/models/product.model';

export const app = createApp();

export async function createUserToken(role: UserRole = 'customer'): Promise<string> {
  const user = await User.create({
    email: `user-${new Types.ObjectId().toString()}@example.com`,
    name: 'Test User',
    password: 'secret123',
    role,
  });
  const { token, jti } = signToken({ sub: user._id.toString(), role });
  // Mirror what the auth service does on login so requireAuth's store check passes.
  await tokenStore.save(jti, ttlSecondsFrom(config.jwtExpiresIn));
  return token;
}

export async function createProduct(overrides: Partial<IProduct> = {}): Promise<IProduct> {
  return Product.create({
    name: overrides.name ?? 'Test Product',
    price: overrides.price ?? 100000,
    stock: overrides.stock ?? 10,
    isActive: overrides.isActive ?? true,
  });
}
