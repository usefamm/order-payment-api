import { Product, type IProduct } from '../../models/product.model';
import { AppError } from '../../shared/errors/AppError';
import type { CreateProductInput } from './product.schema';

export async function createProduct(input: CreateProductInput): Promise<IProduct> {
  return Product.create(input);
}

export async function listProducts(includeInactive = false): Promise<IProduct[]> {
  const filter = includeInactive ? {} : { isActive: true };
  return Product.find(filter).sort({ createdAt: -1 });
}

export async function getProduct(id: string): Promise<IProduct> {
  const product = await Product.findById(id);
  if (!product) throw AppError.notFound('Product not found');
  return product;
}
