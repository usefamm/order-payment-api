import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import orderRoutes from './modules/orders/order.routes';
import paymentRoutes from './modules/payments/payment.routes';
import { notFound } from './shared/middleware/notFound';
import { errorHandler } from './shared/middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Security & transport hardening.
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // A coarse limiter keeps abuse of the auth/payment endpoints cheap to attempt.
  app.use(
    '/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }),
  );

  app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

  app.use('/auth', authRoutes);
  app.use('/products', productRoutes);
  app.use('/orders', orderRoutes);
  app.use('/payments', paymentRoutes);

  // Order matters: unmatched routes, then the single central error handler.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
