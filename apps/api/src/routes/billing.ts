import type { FastifyInstance } from 'fastify';

export async function billingRoutes(app: FastifyInstance) {
  app.post('/checkout', async (_request, reply) => {
    return reply.status(501).send({ error: 'Billing not yet implemented — Phase 11-12' });
  });

  app.get('/portal', async (_request, reply) => {
    return reply.status(501).send({ error: 'Billing not yet implemented — Phase 11-12' });
  });

  app.get('/usage', async () => {
    return {
      voiceMinutes: 0,
      aiGenerations: 0,
      storageBytes: 0,
      deploymentsCount: 0,
      plan: 'free',
      limits: {
        voiceMinutes: 10,
        aiGenerations: 5,
        projects: 1,
        deployments: 0,
      },
    };
  });

  app.post('/webhook', async (request, reply) => {
    return reply.status(501).send({ error: 'Stripe webhook not yet implemented' });
  });
}
