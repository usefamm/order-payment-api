import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../../config/env';

export interface TokenPayload {
  sub: string;
  role: string;
  /** Unique token id; mirrored in the token store so it can be revoked. */
  jti: string;
}

/** A freshly issued token: the signed JWT plus the id stored server-side. */
export interface IssuedToken {
  token: string;
  jti: string;
}

export function signToken(payload: { sub: string; role: string }): IssuedToken {
  const jti = randomUUID();
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  // jti goes in the payload (not options.jwtid, which jsonwebtoken forbids
  // when the payload already carries one).
  const token = jwt.sign({ ...payload, jti }, config.jwtSecret, options);
  return { token, jti };
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === 'string') throw new Error('Unexpected token payload');
  return {
    sub: String(decoded.sub),
    role: String((decoded as { role?: string }).role ?? 'customer'),
    jti: String((decoded as { jti?: string }).jti ?? ''),
  };
}
