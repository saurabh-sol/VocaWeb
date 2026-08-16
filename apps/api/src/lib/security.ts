import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerSecurity(app: FastifyInstance) {
  app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.x.ai wss://api.x.ai https://api.anthropic.com",
    );
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      request.url.startsWith('/api/billing/webhook')
    ) {
      return;
    }
  });
}

export function validateFileSize(content: string, maxBytes = 500_000): void {
  if (content.length > maxBytes) {
    throw new Error(`File exceeds maximum size of ${maxBytes} bytes`);
  }
}

export function sanitizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\.\./g, '').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}
