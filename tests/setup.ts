import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/database/connect';
import { tokenStore } from '../src/shared/auth/tokenStore';

beforeAll(async () => {
  await connectDatabase();
});

afterAll(async () => {
  await tokenStore.close();
  await disconnectDatabase();
});

// Give each test a clean set of collections; indexes stay because they are
// created on model init, not here.
beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});
