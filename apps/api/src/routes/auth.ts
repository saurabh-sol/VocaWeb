import type { FastifyInstance } from 'fastify';
import { getAuthUser } from '../lib/auth.js';

export async function authRoutes(app: FastifyInstance) {
  app.get('/me', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return { user };
  });

  app.post('/sync', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    return { synced: true, user };
  });
}
