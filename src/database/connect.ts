import mongoose from 'mongoose';
import { config } from '../config/env';

export async function connectDatabase(uri = config.mongoUri): Promise<typeof mongoose> {
  // Fail fast instead of silently buffering writes when the DB is unreachable.
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', config.env !== 'test');

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
