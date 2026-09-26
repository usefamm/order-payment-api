import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  env: NodeEnv;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  redisUrl?: string;
}

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

// In tests we lean on the in-memory Mongo + a throwaway secret, so defaults are
// acceptable. Outside of tests the secret must come from the environment.
const env = (process.env.NODE_ENV as NodeEnv) || 'development';
const isTest = env === 'test';

export const config: AppConfig = {
  env,
  port: Number(required('PORT', process.env.PORT, '3000')),
  mongoUri: required(
    'MONGO_URI',
    process.env.MONGO_URI,
    'mongodb://127.0.0.1:27017/order_payment',
  ),
  jwtSecret: required('JWT_SECRET', process.env.JWT_SECRET, isTest ? 'test-secret' : undefined),
  jwtExpiresIn: required('JWT_EXPIRES_IN', process.env.JWT_EXPIRES_IN, '1d'),
  // Optional: when set, issued access tokens live in Redis and can be revoked.
  redisUrl: process.env.REDIS_URL,
};
