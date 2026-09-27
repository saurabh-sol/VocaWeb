import type { FastifyInstance } from 'fastify';
import { getProjectFileTree } from '../lib/project-manager.js';
import { generatePreviewHtml } from '../lib/preview-manager.js';
import { getAuthUser } from '../lib/auth.js';
import { getProject } from '@theo/db';

export async function previewRoutes(app: FastifyInstance) {
  app.get('/:projectId', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { projectId } = request.params as { projectId: string };

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    const files = getProjectFileTree(projectId);

    if (Object.keys(files).length === 0) {
      return reply.status(404).send({ error: 'Project not found or empty' });
    }

    const html = generatePreviewHtml(files);
    return reply.type('text/html').send(html);
  });
}
