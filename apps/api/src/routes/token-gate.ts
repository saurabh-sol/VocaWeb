import type { FastifyInstance } from 'fastify';
import { getAuthUser, requireAuthUser } from '../lib/privy-auth.js';
import {
  verifyModelAccess,
  getTrialState,
  getTokenBalance,
  type ModelTier,
} from '../lib/token-gate.js';

export async function tokenGateRoutes(app: FastifyInstance) {
  app.post('/verify', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { walletAddress, tier } = request.body as {
      walletAddress?: string;
      tier?: ModelTier;
    };

    if (!tier || !['v1', 'v2', 'v3'].includes(tier)) {
      return reply.status(400).send({ error: 'Invalid tier. Must be v1, v2, or v3.' });
    }

    const result = await verifyModelAccess(walletAddress ?? null, tier, user.userId);
    return result;
  });

  app.get('/balance', async (request, reply) => {
    const { wallet } = request.query as { wallet?: string };

    if (!wallet) {
      return reply.status(400).send({ error: 'wallet query parameter required' });
    }

    const balance = await getTokenBalance(wallet);
    return { wallet, balance };
  });

  app.get('/trials', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const state = await getTrialState(user.userId);
    return state;
  });
}
