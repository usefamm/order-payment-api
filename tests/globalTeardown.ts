import type { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalTeardown(): Promise<void> {
  const server = (globalThis as { __mongoServer?: MongoMemoryServer }).__mongoServer;
  if (server) await server.stop();
}
