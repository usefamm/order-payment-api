import { connectDatabase, disconnectDatabase } from '../database/connect';
import { User } from '../models/user.model';
import { Product } from '../models/product.model';

/**
 * Seeds an admin account and a couple of products so the API is immediately
 * testable after a fresh clone. Safe to run more than once.
 */
async function seed(): Promise<void> {
  await connectDatabase();

  const adminEmail = 'admin@example.com';
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    await User.create({
      email: adminEmail,
      name: 'Store Admin',
      password: 'admin12345', // change before any real deployment
      role: 'admin',
    });
  }

  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    await Product.insertMany([
      { name: 'Mechanical Keyboard', price: 2000000, stock: 10 },
      { name: 'USB-C Cable', price: 150000, stock: 3 },
      { name: 'Demo Out-of-stock Item', price: 500000, stock: 0 },
    ]);
  }

  // eslint-disable-next-line no-console
  console.log('seed complete. admin login: admin@example.com / admin12345');
  await disconnectDatabase();
}

seed().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('seed failed', err);
  await disconnectDatabase();
  process.exit(1);
});
