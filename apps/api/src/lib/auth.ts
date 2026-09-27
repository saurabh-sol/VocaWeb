import { createClerkClient, verifyToken } from '@clerk/backend';
import type { FastifyRequest } from 'fastify';
import { findOrCreateUser, findUserByExternalId } from '@theo/db';
import { getAllowedOrigins } from './cors-origins.js';

export interface AuthUser {
  /** Id from the sign-in provider (Clerk user id, or a synthetic id for SDK keys). */
  clerkUserId: string;
  /** Our own users.id, which every other table references. */
  userId: string;
  email: string;
  name: string;
  image?: string;
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_CACHE_MAX = 5000;
const userCache = new Map<string, { user: AuthUser; expires: number }>();

function getCached(externalId: string): AuthUser | null {
  const hit = userCache.get(externalId);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    userCache.delete(externalId);
    return null;
  }
  return hit.user;
}

function setCached(user: AuthUser): void {
  if (userCache.size >= USER_CACHE_MAX) {
    const oldest = userCache.keys().next().value;
    if (oldest) userCache.delete(oldest);
  }
  userCache.set(user.clerkUserId, { user, expires: Date.now() + USER_CACHE_TTL_MS });
}

function getSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY?.trim();
  if (!key) throw new Error('CLERK_SECRET_KEY is not configured');
  return key;
}

let clerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerk() {
  if (!clerkClient) clerkClient = createClerkClient({ secretKey: getSecretKey() });
  return clerkClient;
}

/** Front ends allowed to mint tokens for this API. Defaults to the CORS allow list. */
function getAuthorizedParties(): string[] {
  const explicit =
    process.env.CLERK_AUTHORIZED_PARTIES ?? process.env.CLERK_AUTHORIZED_PARTY ?? '';
  const parties = explicit
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return parties.length > 0 ? parties : getAllowedOrigins();
}

function isApiKey(token: string): boolean {
  return token.startsWith('dk_');
}

async function authenticateApiKey(token: string): Promise<AuthUser | null> {
  const validKeys = (
    process.env.VOCAWEB_SDK_API_KEYS ??
    process.env.VOCAWEB_SDK_API_KEY ??
    process.env.DROOPER_SDK_API_KEYS ??
    process.env.DROOPER_SDK_API_KEY ??
    ''
  )
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (validKeys.length === 0 || !validKeys.includes(token)) {
    return null;
  }

  const keyId = token.slice(3, 11);
  const syntheticId = `sdk_${keyId}`;
  const email = `${syntheticId}@sdk.vocaweb.xyz`;

  const { id: userId } = await findOrCreateUser(
    syntheticId,
    email,
    `SDK User (${keyId})`,
    undefined,
  );

  return {
    clerkUserId: syntheticId,
    userId,
    email,
    name: `SDK User (${keyId})`,
  };
}

async function loadUser(clerkUserId: string): Promise<AuthUser> {
  const cached = getCached(clerkUserId);
  if (cached) return cached;

  const existing = await findUserByExternalId(clerkUserId);
  if (existing) {
    const user: AuthUser = {
      clerkUserId,
      userId: existing.id,
      email: existing.email,
      name: existing.name,
      image: existing.image ?? undefined,
    };
    setCached(user);
    return user;
  }

  // First request from this account: read the profile from Clerk once and store it.
  const profile = await getClerk().users.getUser(clerkUserId);
  const email =
    profile.primaryEmailAddress?.emailAddress ??
    profile.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@users.vocaweb.xyz`;
  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() ||
    profile.username ||
    email.split('@')[0];
  const image = profile.hasImage ? profile.imageUrl : undefined;

  const { id: userId } = await findOrCreateUser(clerkUserId, email, name, image);
  const user: AuthUser = { clerkUserId, userId, email, name, image };
  setCached(user);
  return user;
}

export async function getAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  if (isApiKey(token)) {
    return authenticateApiKey(token);
  }

  let clerkUserId: string;
  try {
    const claims = await verifyToken(token, {
      secretKey: getSecretKey(),
      jwtKey: process.env.CLERK_JWT_KEY?.trim() || undefined,
      authorizedParties: getAuthorizedParties(),
    });
    if (!claims.sub) return null;
    clerkUserId = claims.sub;
  } catch (err) {
    request.log.warn({ err }, 'Session token rejected');
    return null;
  }

  try {
    return await loadUser(clerkUserId);
  } catch (err) {
    request.log.error({ err }, 'Could not load the signed-in user');
    return null;
  }
}

export async function requireAuthUser(request: FastifyRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) throw new Error('Unauthorized');
  return user;
}
