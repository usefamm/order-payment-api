import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/codes';
import { signToken } from '../../shared/auth/token';
import { tokenStore, ttlSecondsFrom } from '../../shared/auth/tokenStore';
import { config } from '../../config/env';
import { User, type IUser } from '../../models/user.model';
import type { LoginInput, RegisterInput } from './auth.schema';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string; role: string };
}

function toPublic(user: IUser): AuthResult['user'] {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) {
    throw AppError.conflict('Email already registered', ErrorCodes.DUPLICATE_RESOURCE);
  }

  const user = await User.create({ ...input, role: 'customer' });
  return issueSession(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  // The password field is `select:false`, so opt back in for the compare.
  const user = await User.findOne({ email: input.email }).select('+password');
  // Same message for unknown email and bad password: don't leak which accounts exist.
  if (!user) throw AppError.unauthorized('Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);

  const ok = await user.comparePassword(input.password);
  if (!ok) throw AppError.unauthorized('Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);

  return issueSession(user);
}

/**
 * Signs an access token and records its jti in the token store (Redis when
 * configured) with the same TTL as the JWT, so revocation is possible for
 * exactly as long as the token could still be used.
 */
async function issueSession(user: IUser): Promise<AuthResult> {
  const { token, jti } = signToken({ sub: user._id.toString(), role: user.role });
  await tokenStore.save(jti, ttlSecondsFrom(config.jwtExpiresIn));
  return { token, user: toPublic(user) };
}

/** Revoke the caller's current token: after logout it fails store checks. */
export async function logout(jti: string): Promise<void> {
  await tokenStore.remove(jti);
}
