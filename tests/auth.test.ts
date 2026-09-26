import request from 'supertest';
import { app } from './helpers';

async function registerAndLogin(): Promise<string> {
  const email = `a${Date.now()}@example.com`;
  await request(app)
    .post('/auth/register')
    .send({ name: 'Ada', email, password: 'secret123' });
  const res = await request(app).post('/auth/login').send({ email, password: 'secret123' });
  return res.body.data.token;
}

describe('auth token lifecycle', () => {
  it('issues a token that authenticates, then revokes it on logout', async () => {
    const token = await registerAndLogin();

    // Token is valid: /orders/me-style route (GET /orders/:id with bad id)
    // reaches the auth layer and fails at validation (400), not at auth (401).
    const beforeLogout = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect(beforeLogout.status).toBe(400); // passed auth, failed body validation

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);
    expect(logout.body.data.revoked).toBe(true);

    // Same, still-unexpired token is now rejected because its jti is gone.
    const afterLogout = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects a login with the wrong password', async () => {
    const email = `b${Date.now()}@example.com`;
    await request(app)
      .post('/auth/register')
      .send({ name: 'Ben', email, password: 'secret123' });

    const res = await request(app).post('/auth/login').send({ email, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});
