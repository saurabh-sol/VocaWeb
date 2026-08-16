import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createWaitlistSubscriber } from '@theo/db';

const contactBodySchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  message: z.string().trim().min(1, 'Message is required').max(2000),
  source: z.string().trim().max(64).optional(),
});

export async function contactRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const parsed = contactBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid form data',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, name, message, source } = parsed.data;

    try {
      const submission = await createWaitlistSubscriber({
        email,
        name,
        message,
        source: source || 'footer-contact',
        userAgent: request.headers['user-agent'] ?? null,
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        ok: true,
        message: 'Thanks for contacting us!',
        submission: {
          id: submission.id,
          email: submission.email,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to save contact submission');
      return reply.status(500).send({ error: 'Could not send your message. Please try again.' });
    }
  });
}
