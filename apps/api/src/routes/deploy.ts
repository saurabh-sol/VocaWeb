import type { FastifyInstance } from 'fastify';
import {
  getProjectFileTreeAsync,
  persistProjectToDb,
} from '../lib/project-manager.js';
import {
  deployToVercel,
  checkDeploymentStatus,
  setCustomDomain,
  getDeploymentDomains,
  getVercelProjectName,
  getVercelToken,
  resolvePublicDeployUrl,
  resolveStableVercelUrl,
} from '../lib/deployer.js';
import { requireAuthUser, getAuthUser } from '../lib/auth.js';
import {
  getProject,
  getProjectDeployments,
  saveDeployment,
  updateDeploymentByExternalId,
  updateProjectDomain,
  updateProjectVercelId,
} from '@theo/db';

export async function deployRoutes(app: FastifyInstance) {
  app.post('/:projectId', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { projectId } = request.params as { projectId: string };
    const { platform, customDomain, files: bodyFiles } =
      (request.body as {
        platform?: string;
        customDomain?: string;
        files?: Record<string, string>;
      }) ?? {};

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    let files =
      bodyFiles && Object.keys(bodyFiles).length > 0
        ? bodyFiles
        : await getProjectFileTreeAsync(projectId);

    if (Object.keys(files).length === 0) {
      return reply.status(404).send({ error: 'Project not found or empty' });
    }

    // Sync files to server memory + DB before deploy
    if (bodyFiles && Object.keys(bodyFiles).length > 0) {
      const { writeProjectFile } = await import('../lib/project-manager.js');
      for (const [path, content] of Object.entries(bodyFiles)) {
        writeProjectFile(projectId, path, content);
      }
    }

    if (!project) {
      await persistProjectToDb(projectId, user.userId, 'Untitled', 'nextjs');
    }

    const dbProject = (await getProject(projectId)) ?? project;

    try {
      if (platform === 'netlify' || platform === 'cloudflare') {
        return reply.status(501).send({ error: `${platform} deployment not yet implemented` });
      }

      const persistentDomain = customDomain ?? undefined;

      const result = await deployToVercel(projectId, files, { persistentDomain });

      const vercelProjectName = getVercelProjectName(projectId);
      await updateProjectVercelId(projectId, vercelProjectName).catch(() => {});

      if (customDomain) {
        await updateProjectDomain(projectId, customDomain).catch(() => {});
      }

      await saveDeployment(
        projectId,
        'vercel',
        result.deploymentId,
        result.url,
        result.status,
        result.customDomainUrl ? persistentDomain : undefined,
      ).catch(() => {});

      await persistProjectToDb(
        projectId,
        user.userId,
        dbProject?.name ?? 'Untitled',
        dbProject?.framework ?? 'nextjs',
      );

      return {
        ...result,
        persistentDomain: result.customDomainUrl ? persistentDomain : undefined,
        liveUrl: resolveStableVercelUrl(projectId, result.url),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.get('/:projectId/history', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { projectId } = request.params as { projectId: string };
    const project = await getProject(projectId);
    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const deployments = await getProjectDeployments(projectId);
    return { deployments };
  });

  app.get('/:projectId/:deployId/status', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Authentication required' });

    const { projectId, deployId } = request.params as { projectId: string; deployId: string };
    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await checkDeploymentStatus(deployId, projectId);
      const liveUrl = resolveStableVercelUrl(projectId, result.url);
      await updateDeploymentByExternalId(deployId, result.status, liveUrl).catch(() => {});
      return { ...result, liveUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check status';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/:projectId/domain', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { projectId } = request.params as { projectId: string };
    const { domain } = (request.body as { domain?: string }) ?? {};

    if (!domain) {
      return reply.status(400).send({ error: 'domain is required' });
    }

    const project = await getProject(projectId);
    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await setCustomDomain(projectId, domain);
      await updateProjectDomain(projectId, domain);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set domain';
      return reply.status(500).send({ error: message });
    }
  });

  app.get('/:projectId/domains', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Authentication required' });

    const { projectId } = request.params as { projectId: string };
    const project = await getProject(projectId).catch(() => null);

    if (project && project.user_id !== user.userId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    try {
      const vercelDomains = await getDeploymentDomains(projectId);
      const persistentDomain = project?.custom_domain ?? null;
      const primaryUrl = resolvePublicDeployUrl(projectId);
      return {
        persistentDomain,
        primaryUrl,
        domains: vercelDomains,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get domains';
      if (message.includes('404') || message.includes('not found') || message.includes('NOT_FOUND')) {
        return {
          persistentDomain: project?.custom_domain ?? null,
          primaryUrl: resolvePublicDeployUrl(projectId),
          domains: [],
        };
      }
      return reply.status(500).send({ error: message });
    }
  });

  app.get('/status/token', async (_request, reply) => {
    try {
      getVercelToken();
      return { configured: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Not configured';
      return reply.status(503).send({ configured: false, error: message });
    }
  });
}
