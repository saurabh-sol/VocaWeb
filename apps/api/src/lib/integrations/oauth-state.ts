import { createHmac, createHash, randomBytes } from 'node:crypto';

interface PendingOAuth {
  userId: string;
  provider: string;
  codeVerifier?: string;
  redirectAfter?: string;
  expiresAt: number;
}

const pending = new Map<string, PendingOAuth>();
const TTL_MS = 10 * 60 * 1000;

function signState(payload: string): string {
  const secret =
    process.env.INTEGRATION_TOKEN_SECRET ??
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('INTEGRATION_TOKEN_SECRET or JWT_SECRET must be set for OAuth state signing');
  }
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createOAuthState(
  userId: string,
  provider: string,
  options?: { codeVerifier?: string; redirectAfter?: string },
): string {
  const id = randomBytes(16).toString('hex');
  pending.set(id, {
    userId,
    provider,
    codeVerifier: options?.codeVerifier,
    redirectAfter: options?.redirectAfter,
    expiresAt: Date.now() + TTL_MS,
  });
  const payload = `${id}.${provider}`;
  return `${payload}.${signState(payload)}`;
}

export function consumeOAuthState(state: string): PendingOAuth | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [id, provider, sig] = parts;
  const payload = `${id}.${provider}`;
  if (signState(payload) !== sig) return null;

  const entry = pending.get(id);
  pending.delete(id);
  if (!entry || entry.provider !== provider || entry.expiresAt < Date.now()) return null;
  return entry;
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}
