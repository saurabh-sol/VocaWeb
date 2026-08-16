import type { FastifyRequest, FastifyReply } from 'fastify';
import { isOriginAllowed } from './cors-origins.js';

/** Resolved Allow-Origin for SSE (must echo the request origin, not a static fallback). */
export function corsOrigin(request: FastifyRequest): string | null {
  const origin = request.headers.origin?.trim().replace(/\/+$/, '');
  if (origin && isOriginAllowed(origin)) return origin;
  return null;
}

export function corsHeaders(request: FastifyRequest): Record<string, string> {
  const origin = corsOrigin(request);
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  };
}

/** Returns false if the request origin is not allowed (reply already sent). */
export function writeSseHeaders(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = corsOrigin(request);
  if (!origin) {
    reply.status(403).send({ error: 'CORS origin not allowed' });
    return false;
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return true;
}

export function sendSseEvent(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
