import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes/index.js';
import { registerSecurity } from './lib/security.js';
import { isOriginAllowed } from './lib/cors-origins.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser clients (curl, server-side) may omit Origin.
      if (!origin || isOriginAllowed(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);
  await app.register(websocket);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  await registerSecurity(app);

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      app.log.error(error, `Unhandled error on ${request.method} ${request.url}`);
    }
    reply.status(status).send({
      error: status >= 500 ? 'Internal server error' : error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.0.1',
  }));

  app.get('/health/db', async (request, reply) => {
    try {
      const { sql } = await import('@theo/db');
      const result = await sql`SELECT version()`;
      const version = result[0]?.version ?? 'unknown';
      return { status: 'ok', database: 'connected', version };
    } catch (err) {
      app.log.error(err, 'Database health check failed');
      return reply.status(503).send({
        status: 'error',
        database: 'disconnected',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  await app.register(registerRoutes, { prefix: '/api' });

  return app;
}
