import { PrivyClient } from '@privy-io/server-auth';
import type { FastifyRequest } from 'fastify';
import { findOrCreateUser } from '@theo/db';

export interface AuthUser {
  /** External provider ID (Privy user ID or SDK synthetic ID). Named for DB column compat. */
  clerkUserId: string;
  userId: string;
  email: string;
  name: string;
  image?: string;
}

let privyClient: PrivyClient | null = null;

function getPrivy() {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET not configured');
    }
    privyClient = new PrivyClient(appId, appSecret);
  }
  return privyClient;
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
    .map(k => k.trim())
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

export async function getAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  if (isApiKey(token)) {
    return authenticateApiKey(token);
  }

  try {
    const privy = getPrivy();
    const verifiedClaims = await privy.verifyAuthToken(token);

    const privyUserId = verifiedClaims.userId;
    if (!privyUserId) return null;

    const privyUser = await privy.getUser(privyUserId);

    let email = '';
    let name = '';
    
    const emailAccount = privyUser.linkedAccounts.find(a => a.type === 'email');
    if (emailAccount && 'address' in emailAccount) {
      email = emailAccount.address;
    }
    
    const walletAccount = privyUser.linkedAccounts.find(a => a.type === 'wallet');
    if (!email && walletAccount && 'address' in walletAccount) {
      email = `${walletAccount.address}@wallet.local`;
      name = walletAccount.address.slice(0, 6) + '...' + walletAccount.address.slice(-4);
    }

    if (!email) {
      email = `${privyUserId}@privy.local`;
    }

    if (!name) {
      name = email.split('@')[0];
    }

    const { id: userId } = await findOrCreateUser(
      privyUserId,
      email,
      name,
      undefined,
    );

    return {
      clerkUserId: privyUserId, 
      userId,
      email,
      name,
    };
  } catch (err) {
    console.error('Privy auth error:', err);
    return null;
  }
}

export async function requireAuthUser(request: FastifyRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) throw new Error('Unauthorized');
  return user;
}