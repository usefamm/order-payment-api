import { existsSync } from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots a throwaway MongoDB once for the whole (single-process, --runInBand)
 * test run and points MONGO_URI at it, so the suite needs no manually managed
 * database.
 *
 * If MONGO_URI is already set (e.g. a Docker/local mongod in CI) we use it as
 * is. Otherwise we prefer a system mongod binary to avoid a slow/flaky binary
 * download, falling back to the downloaded binary only when none is found.
 */
const SYSTEM_MONGOD_CANDIDATES = [
  process.env.MONGOMS_SYSTEM_BINARY,
  '/opt/homebrew/bin/mongod',
  '/usr/local/bin/mongod',
].filter((p): p is string => Boolean(p));

export default async function globalSetup(): Promise<void> {
  if (process.env.MONGO_URI) return;

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.NODE_ENV = 'test';

  const systemBinary = SYSTEM_MONGOD_CANDIDATES.find((p) => existsSync(p));
  // Modern mongod dropped the `ephemeralForTest` engine, so force wiredTiger.
  const server = await MongoMemoryServer.create({
    binary: systemBinary ? { systemBinary } : undefined,
    instance: { storageEngine: 'wiredTiger' },
  });

  process.env.MONGO_URI = server.getUri();
  (globalThis as { __mongoServer?: MongoMemoryServer }).__mongoServer = server;
}
