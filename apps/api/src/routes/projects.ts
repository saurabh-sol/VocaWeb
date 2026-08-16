import type { FastifyInstance } from 'fastify';
import {
  createProject,
  deleteProject,
  getProjectFileTree,
  getProjectFileTreeAsync,
  writeProjectFile,
  persistProjectToDb,
  loadProjectFromDb,
} from '../lib/project-manager.js';
import { requireAuthUser, getAuthUser } from '../lib/privy-auth.js';
import {
  getUserProjects,
  getProject,
  updateProjectName,
  deleteProjectFromDb,
} from '@theo/db';

export async function projectRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const projects = await getUserProjects(user.userId);
    return { projects };
  });

  app.post('/', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { name, framework } = request.body as { name: string; framework?: string };
    const project = createProject(name || 'Untitled Project', framework);
    await persistProjectToDb(project.id, user.userId, project.name, project.framework);

    return {
      project: {
        ...project,
        createdAt: new Date().toISOString(),
      },
    };
  });

  app.get('/:id', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    await loadProjectFromDb(id);
    const files = await getProjectFileTreeAsync(id);
    return { project: meta, files };
  });

  app.get('/:id/files', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const files = await getProjectFileTreeAsync(id);
    return { files };
  });

  app.get('/:id/files/*', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id, '*': filePath } = request.params as { id: string; '*': string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const files = await getProjectFileTreeAsync(id);
    const content = files[filePath];
    if (content === undefined) return reply.status(404).send({ error: 'File not found' });
    return { path: filePath, content };
  });

  app.put('/:id/files/*', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id, '*': filePath } = request.params as { id: string; '*': string };
    const { content } = request.body as { content: string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    writeProjectFile(id, filePath, content);
    await persistProjectToDb(id, user.userId, meta.name, meta.framework);
    return { path: filePath, size: content.length };
  });

  app.patch('/:id', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const { name } = request.body as { name?: string };
    if (name) await updateProjectName(id, name);
    return { project: { ...meta, name: name ?? meta.name } };
  });

  app.delete('/:id', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const meta = await getProject(id);
    if (!meta || meta.user_id !== user.userId) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    deleteProject(id);
    await deleteProjectFromDb(id);
    return { deleted: true };
  });
}
