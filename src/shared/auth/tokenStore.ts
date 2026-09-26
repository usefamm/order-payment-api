import { Redis } from 'ioredis';
import { config } from '../../config/env';

/**
 * Server-side registry of issued access tokens. The JWT still proves its own
 * signature, but every request must also find its `jti` in this store — which
 * means logout (or an admin sweep) can revoke a token instantly instead of
 * waiting for it to expire.
 */
export interface TokenStore {
  save(jti: string, ttlSeconds: number): Promise<void>;
  exists(jti: string): Promise<boolean>;
  remove(jti: string): Promise<void>;
  close(): Promise<void>;
}

/** Turn "1d" / "12h" / "30m" / "900s" into seconds for the Redis TTL. */
export function ttlSecondsFrom(duration: string): number {
  const match = /^(\d+)([smhd])?$/.exec(duration.trim());
  if (!match) return 3600;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
  return value * factor;
}

class RedisTokenStore implements TokenStore {
  private readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, { keyPrefix: 'auth:token:' });
  }

  async save(jti: string, ttlSeconds: number): Promise<void> {
    await this.client.set(jti, '1', 'EX', ttlSeconds);
  }

  async exists(jti: string): Promise<boolean> {
    return (await this.client.exists(jti)) === 1;
  }

  async remove(jti: string): Promise<void> {
    await this.client.del(jti);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Fallback used by the test suite (and small local setups that don't run
 * Redis). Same contract, same TTL semantics, just process memory.
 */
class MemoryTokenStore implements TokenStore {
  private readonly entries = new Map<string, number>();

  async save(jti: string, ttlSeconds: number): Promise<void> {
    this.entries.set(jti, Date.now() + ttlSeconds * 1000);
  }

  async exists(jti: string): Promise<boolean> {
    const expiresAt = this.entries.get(jti);
    if (expiresAt === undefined) return false;
    if (Date.now() >= expiresAt) {
      this.entries.delete(jti);
      return false;
    }
    return true;
  }

  async remove(jti: string): Promise<void> {
    this.entries.delete(jti);
  }

  async close(): Promise<void> {
    this.entries.clear();
  }
}

export const tokenStore: TokenStore = config.redisUrl
  ? new RedisTokenStore(config.redisUrl)
  : new MemoryTokenStore();
