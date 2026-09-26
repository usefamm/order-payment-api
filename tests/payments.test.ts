import request from 'supertest';
import { app, createProduct, createUserToken } from './helpers';
import { Order } from '../src/models/order.model';
import { Product } from '../src/models/product.model';

async function createPaidOrder(token: string, productId: string, quantity = 1) {
  const res = await request(app)
    .post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId, quantity }] });
  return res.body.data;
}

describe('payments', () => {
  it('creates a payment for the server-side order amount (5)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 2000000, stock: 5 });
    const order = await createPaidOrder(token, product._id.toString(), 1);

    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'abc-123')
      .send({ orderId: order.id, amount: 2000000 });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(2000000);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.providerRef).toMatch(/^prov_/);
  });

  it('confirms the order on callback and is idempotent for repeats (6)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 100000, stock: 5 });
    const order = await createPaidOrder(token, product._id.toString(), 2);

    const payment = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    const paymentRef = payment.body.data.providerRef;

    // Three callbacks arrive for the same payment.
    const results = await Promise.all([
      request(app).post('/payments/callback').send({ paymentRef, status: 'succeeded' }),
      request(app).post('/payments/callback').send({ paymentRef, status: 'succeeded' }),
      request(app).post('/payments/callback').send({ paymentRef, status: 'succeeded' }),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.data.processed === true)).toHaveLength(1);

    const finalOrder = await Order.findById(order.id);
    expect(finalOrder?.status).toBe('paid');

    // Stock was reserved once at order creation and must not change on callback.
    const refreshed = await Product.findById(product._id);
    expect(refreshed?.stock).toBe(3); // 5 - 2, not decremented again
  });

  it('returns the existing payment for a reused idempotency key (7)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 500000, stock: 5 });
    const order = await createPaidOrder(token, product._id.toString(), 1);

    const first = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'same-key')
      .send({ orderId: order.id });
    const second = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'same-key')
      .send({ orderId: order.id });

    expect(first.body.data.id).toBe(second.body.data.id); // no second payment created
  });

  it('rejects a payment amount that does not match the order total (8)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 2000000, stock: 5 });
    const order = await createPaidOrder(token, product._id.toString(), 1);

    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id, amount: 100000 }); // trying to underpay

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('releases reserved stock when a payment fails', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 100000, stock: 4 });
    const order = await createPaidOrder(token, product._id.toString(), 2);

    const payment = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    const paymentRef = payment.body.data.providerRef;

    await request(app)
      .post('/payments/callback')
      .send({ paymentRef, status: 'failed' });

    const finalOrder = await Order.findById(order.id);
    const refreshed = await Product.findById(product._id);
    expect(finalOrder?.status).toBe('failed');
    expect(refreshed?.stock).toBe(4); // 2 released back
  });
});
