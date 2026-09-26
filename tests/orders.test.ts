import request from 'supertest';
import { Types } from 'mongoose';
import { app, createProduct, createUserToken } from './helpers';
import { Product } from '../src/models/product.model';

describe('POST /orders', () => {
  it('creates an order for an in-stock active product (1)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 250000, stock: 5 });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalPrice).toBe(500000);
    expect(res.body.data.status).toBe('pending');

    const refreshed = await Product.findById(product._id);
    expect(refreshed?.stock).toBe(3); // 5 - 2 reserved
  });

  it('rejects an unknown product (2)', async () => {
    const token = await createUserToken();
    const missing = new Types.ObjectId();

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: missing.toString(), quantity: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('rejects when stock is insufficient and leaves stock untouched (3)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ stock: 1 });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    const refreshed = await Product.findById(product._id);
    expect(refreshed?.stock).toBe(1);
  });

  it('ignores a tampered price sent by the client', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 2000000, stock: 5 });

    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      // extra `price` field must be stripped and never trusted
      .send({ items: [{ productId: product._id.toString(), quantity: 1, price: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.totalPrice).toBe(2000000);
  });

  it('keeps the snapshot price when the product price changes later (4)', async () => {
    const token = await createUserToken();
    const product = await createProduct({ price: 100000, stock: 5 });

    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 1 }] });
    const orderId = orderRes.body.data.id;

    await Product.updateOne({ _id: product._id }, { $set: { price: 999999 } });

    const fetched = await request(app)
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.data.items[0].unitPrice).toBe(100000);
    expect(fetched.body.data.totalPrice).toBe(100000);
  });

  it('rejects two concurrent orders competing for the last unit (9)', async () => {
    const [tokenA, tokenB] = await Promise.all([createUserToken(), createUserToken()]);
    const product = await createProduct({ stock: 1 });
    const payload = { items: [{ productId: product._id.toString(), quantity: 1 }] };

    const [a, b] = await Promise.all([
      request(app).post('/orders').set('Authorization', `Bearer ${tokenA}`).send(payload),
      request(app).post('/orders').set('Authorization', `Bearer ${tokenB}`).send(payload),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const refreshed = await Product.findById(product._id);
    expect(refreshed?.stock).toBe(0); // never goes negative, never oversold
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/orders').send({ items: [] });
    expect(res.status).toBe(401);
  });
});
