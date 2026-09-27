import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { projectRoutes } from './projects.js';
import { voiceRoutes } from './voice.js';
import { aiRoutes } from './ai.js';
import { previewRoutes } from './preview.js';
import { deployRoutes } from './deploy.js';
import { billingRoutes } from './billing.js';
import { conversationRoutes } from './conversations.js';
import { contactRoutes } from './contact.js';
import { integrationRoutes } from './integrations.js';
import { getCanvaMcpCimdDocument } from '../lib/mcp/canva-mcp-oauth.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/.well-known/canva-mcp-client.json', async () => getCanvaMcpCimdDocument());
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(voiceRoutes, { prefix: '/voice' });
  await app.register(aiRoutes, { prefix: '/ai' });
  await app.register(conversationRoutes, { prefix: '/conversations' });
  await app.register(previewRoutes, { prefix: '/preview' });
  await app.register(deployRoutes, { prefix: '/deploy' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(contactRoutes, { prefix: '/contact' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
}
