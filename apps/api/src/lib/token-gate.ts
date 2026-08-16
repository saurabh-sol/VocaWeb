/**
 * Token-gate service for $DROOP token verification using Helius RPC.
 * Checks Solana wallet balances to enforce model tier access.
 * Trial state persisted in Redis (survives restarts).
 */

import { redis } from './redis.js';

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL ?? '';

const DROOP_TOKEN_MINT = process.env.DROOP_TOKEN_MINT ?? '';

export type ModelTier = 'v1' | 'v2' | 'v3';

export const TIER_REQUIREMENTS: Record<ModelTier, number> = {
  v1: 0,
  v2: 250_000,
  v3: 1_000_000,
};

const V1_FREE_TRIALS = 2;
const TRIAL_KEY_PREFIX = 'vocaweb:trials:';

interface TokenBalanceResult {
  balance: number;
  eligible: boolean;
  tier: ModelTier;
  message?: string;
}

interface TrialState {
  trialsUsed: number;
  trialsRemaining: number;
}

export async function getTrialState(userId: string): Promise<TrialState> {
  return { trialsUsed: 0, trialsRemaining: 999 };
}

export async function consumeTrial(userId: string): Promise<boolean> {
  try {
    const key = `${TRIAL_KEY_PREFIX}${userId}`;
    const used = parseInt(await redis.get(key) ?? '0', 10);
    if (used >= V1_FREE_TRIALS) return false;
    await redis.set(key, String(used + 1));
    return true;
  } catch {
    return true;
  }
}

export async function getTokenBalance(walletAddress: string): Promise<number> {
  if (!HELIUS_RPC_URL) {
    console.warn('[token-gate] HELIUS_RPC_URL not configured, skipping balance check');
    return 0;
  }
  if (!DROOP_TOKEN_MINT) {
    console.warn('[token-gate] DROOP_TOKEN_MINT not configured, skipping balance check');
    return 0;
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: DROOP_TOKEN_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    });

    const data = (await response.json()) as {
      error?: string;
      result?: { value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }> };
    };

    if (data.error) {
      console.error('[token-gate] Helius RPC error:', data.error);
      return 0;
    }

    const accounts = data.result?.value ?? [];
    if (accounts.length === 0) return 0;

    let total = 0;
    for (const account of accounts) {
      const info = account.account?.data?.parsed?.info;
      if (info?.tokenAmount?.uiAmount) {
        total += info.tokenAmount.uiAmount;
      }
    }

    return total;
  } catch (err) {
    console.error('[token-gate] Failed to fetch token balance:', err);
    return 0;
  }
}

export async function verifyModelAccess(
  walletAddress: string | null,
  requestedTier: ModelTier,
  userId: string,
): Promise<TokenBalanceResult> {
  if (requestedTier === 'v1') {
    return { balance: 0, eligible: true, tier: 'v1' };
  }

  if (!walletAddress) {
    return {
      balance: 0,
      eligible: false,
      tier: requestedTier,
      message: 'Wallet not connected. Connect your Solana wallet to access this tier.',
    };
  }

  const required = TIER_REQUIREMENTS[requestedTier];
  const balance = await getTokenBalance(walletAddress);

  if (balance < required) {
    return {
      balance,
      eligible: false,
      tier: requestedTier,
      message: `Insufficient $DROOP balance. You hold ${balance.toLocaleString()} but need ${required.toLocaleString()} for ${requestedTier === 'v2' ? 'Vocaweb v2 (pro)' : 'Vocaweb v3 (max)'}.`,
    };
  }

  return { balance, eligible: true, tier: requestedTier };
}
