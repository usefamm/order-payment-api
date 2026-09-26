import { Product } from '../../models/product.model';
import { Order, type IOrder, type IOrderItem } from '../../models/order.model';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/codes';
import type { CreateOrderInput } from './order.schema';

interface ReservedLine {
  productId: string;
  quantity: number;
}

/**
 * Puts the requested quantities back on the shelf. Used to undo a partially
 * successful reservation so a rejected order never consumes real stock.
 */
async function releaseStock(reserved: ReservedLine[]): Promise<void> {
  await Promise.all(
    reserved.map((line) =>
      Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } }),
    ),
  );
}

/**
 * Sums duplicate product lines so the stock guard accounts for the total the
 * client is really asking for (e.g. two lines of the same product).
 */
function mergeQuantities(items: CreateOrderInput['items']): Map<string, number> {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  return merged;
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<IOrder> {
  const merged = mergeQuantities(input.items);
  const reserved: ReservedLine[] = [];
  const snapshotItems: IOrderItem[] = [];

  for (const [productId, quantity] of merged) {
    // The single atomic operation that makes overselling impossible under
    // concurrency: the update only matches while enough stock is still there,
    // so two racing buyers can never both consume the same last unit.
    const product = await Product.findOneAndUpdate(
      { _id: productId, isActive: true, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true },
    );

    if (!product) {
      await releaseStock(reserved);
      throw await describeUnavailableProduct(productId);
    }

    reserved.push({ productId, quantity });
    // Prices are snapshotted here; a later Product.price change cannot mutate
    // this order, and the client-supplied price (if any) was never trusted.
    snapshotItems.push({
      productId: product._id,
      name: product.name,
      unitPrice: product.price,
      quantity,
      lineTotal: product.price * quantity,
    });
  }

  const totalPrice = snapshotItems.reduce((sum, item) => sum + item.lineTotal, 0);

  try {
    return await Order.create({ userId, items: snapshotItems, totalPrice, status: 'pending' });
  } catch (err) {
    // Order insert failed after reserving: hand the stock back before bubbling up.
    await releaseStock(reserved);
    throw err;
  }
}

/**
 * When a guarded update matches nothing, work out *why* so the client gets an
 * accurate code instead of a generic failure.
 */
async function describeUnavailableProduct(productId: string): Promise<AppError> {
  const existing = await Product.findById(productId).lean();
  if (!existing) return AppError.notFound('Product not found');
  if (!existing.isActive) {
    return AppError.conflict('Product is not available', ErrorCodes.PRODUCT_NOT_ACTIVE);
  }
  return AppError.conflict('Insufficient stock', ErrorCodes.INSUFFICIENT_STOCK);
}

export async function getOrderForRequester(
  id: string,
  requester: { userId: string; role: string },
): Promise<IOrder> {
  const order = await Order.findById(id);
  if (!order) throw AppError.notFound('Order not found');

  const isOwner = order.userId.toString() === requester.userId;
  if (!isOwner && requester.role !== 'admin') {
    throw AppError.forbidden('You do not have access to this order');
  }
  return order;
}
