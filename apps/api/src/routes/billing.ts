import type { FastifyInstance } from 'fastify';
import { requireAuthUser } from '../lib/auth.js';
import { getUsage } from '../lib/usage.js';

export async function billingRoutes(app: FastifyInstance) {
  /** Today's build allowance for the signed-in user. */
  app.get('/usage', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    return getUsage(user.userId);
  });

  // VocaWeb v1 is free. Paid plans are not built yet.
  app.post('/checkout', async (_request, reply) => {
    return reply.status(501).send({ error: 'Paid plans are not available yet' });
  });

  app.get('/portal', async (_request, reply) => {
    return reply.status(501).send({ error: 'Paid plans are not available yet' });
  });

  app.post('/webhook', async (_request, reply) => {
    return reply.status(501).send({ error: 'Paid plans are not available yet' });
  });
}
