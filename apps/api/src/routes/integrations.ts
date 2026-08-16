import type { FastifyInstance } from 'fastify';
import { requireAuthUser, getAuthUser } from '../lib/privy-auth.js';
import {
  listUserIntegrations,
  deleteUserIntegration,
  type IntegrationProvider,
} from '@theo/db';
import { importRequestSchema } from '@theo/shared';
import {
  createOAuthState,
  consumeOAuthState,
  generatePkcePair,
} from '../lib/integrations/oauth-state.js';
import {
  integrationConfigured,
  getWebRedirectBase,
  isMcpConnectedForProvider,
} from '../lib/integrations/token-store.js';
import { isMcpConfigured } from '../lib/mcp/provider-config.js';
import {
  getCanvaMcpAuthUrl,
  createCanvaMcpOAuthState,
  completeCanvaMcpOAuth,
  isCanvaMcpOAuthConfigured,
  getCanvaMcpCimdDocument,
  isCanvaMcpConnected,
} from '../lib/mcp/canva-mcp-oauth.js';
import {
  getNotionAuthUrl,
  saveNotionIntegration,
  listNotionPages,
  getNotionPageResource,
  extractNotionPageId,
} from '../lib/integrations/notion-adapter.js';
import {
  getCanvaAuthUrl,
  saveCanvaIntegration,
  listCanvaDesigns,
} from '../lib/integrations/canva-adapter.js';
import {
  getFigmaAuthUrl,
  saveFigmaIntegration,
  extractFigmaFileKey,
} from '../lib/integrations/figma-adapter.js';
import {
  runImportPipeline,
  runImportPipelineWithMeta,
  buildPlanFromImportBundle,
  mergeImportBundleIntoDescription,
} from '../lib/import-pipeline.js';
import { buildProjectFromDescription } from '../lib/build-helper.js';
import type { ModelTier } from '../lib/token-gate.js';

const PROVIDERS: IntegrationProvider[] = ['notion', 'canva', 'figma'];

function parseProvider(raw: string): IntegrationProvider | null {
  return PROVIDERS.includes(raw as IntegrationProvider) ? (raw as IntegrationProvider) : null;
}

export async function integrationRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const rows = await listUserIntegrations(user.userId);
    const connectedSet = new Set(rows.map((r) => r.provider));

    return {
      integrations: PROVIDERS.map((provider) => {
        const row = rows.find((r) => r.provider === provider);
        const connected = connectedSet.has(provider);
        return {
          provider,
          connected,
          configured: integrationConfigured(provider),
          mcpConfigured: isMcpConfigured(provider),
          mcpConnected: isMcpConnectedForProvider(provider, row?.metadata ?? null, connected),
          metadata: row?.metadata ?? null,
        };
      }),
    };
  });

  app.get('/:provider/connect', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const provider = parseProvider((request.params as { provider: string }).provider);
    if (!provider) return reply.status(400).send({ error: 'Invalid provider' });
    if (!integrationConfigured(provider)) {
      return reply.status(503).send({ error: `${provider} integration not configured on server` });
    }

    const redirectAfter =
      (request.query as { redirect?: string }).redirect ?? `${getWebRedirectBase()}/settings`;

    let authUrl: string;
    if (provider === 'canva') {
      const { codeVerifier, codeChallenge } = generatePkcePair();
      const state = createOAuthState(user.userId, provider, { codeVerifier, redirectAfter });
      authUrl = getCanvaAuthUrl(state, codeChallenge);
    } else {
      const state = createOAuthState(user.userId, provider, { redirectAfter });
      if (provider === 'notion') authUrl = getNotionAuthUrl(state);
      else authUrl = getFigmaAuthUrl(state);
    }

    return { authUrl };
  });

  app.get('/:provider/callback', async (request, reply) => {
    const provider = parseProvider((request.params as { provider: string }).provider);
    if (!provider) return reply.status(400).send({ error: 'Invalid provider' });

    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const redirectBase = getWebRedirectBase();
    if (error || !code || !state) {
      return reply.redirect(`${redirectBase}/settings?integration=error`);
    }

    const pending = consumeOAuthState(state);
    if (!pending || pending.provider !== provider) {
      return reply.redirect(`${redirectBase}/settings?integration=invalid_state`);
    }

    try {
      if (provider === 'notion') await saveNotionIntegration(pending.userId, code);
      else if (provider === 'canva') {
        if (!pending.codeVerifier) throw new Error('Missing PKCE verifier');
        await saveCanvaIntegration(pending.userId, code, pending.codeVerifier);
      } else await saveFigmaIntegration(pending.userId, code);

      const dest = pending.redirectAfter ?? `${redirectBase}/settings`;
      return reply.redirect(`${dest}?integration=connected&provider=${provider}`);
    } catch (err) {
      app.log.error(err, 'Integration OAuth callback failed');
      return reply.redirect(`${redirectBase}/settings?integration=error&provider=${provider}`);
    }
  });

  app.delete('/:provider', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const provider = parseProvider((request.params as { provider: string }).provider);
    if (!provider) return reply.status(400).send({ error: 'Invalid provider' });

    await deleteUserIntegration(user.userId, provider);
    return { ok: true };
  });

  app.get('/:provider/resources', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const provider = parseProvider((request.params as { provider: string }).provider);
    if (!provider) return reply.status(400).send({ error: 'Invalid provider' });

    try {
      if (provider === 'notion') {
        const { url, query } = request.query as { url?: string; query?: string };

        if (url) {
          const pageId = extractNotionPageId(url);
          if (!pageId) {
            return {
              resources: [],
              hint: 'Paste a valid Notion page URL (notion.so/... or notion.site/...).',
            };
          }
          const page = await getNotionPageResource(user.userId, pageId);
          if (!page) {
            return {
              resources: [],
              hint:
                'This page is not accessible. In Notion, open the page → ⋯ → Connections → add your Vocaweb integration, or reconnect Notion and select the page.',
            };
          }
          return { resources: [page] };
        }

        const pages = await listNotionPages(user.userId, { query });
        return {
          resources: pages,
          hint:
            pages.length === 0
              ? 'No pages found. During Notion connect, select every page you want to import — or open notion.so/my-integrations and add page access to Vocaweb.'
              : pages.length <= 2
                ? 'Only seeing a few pages? Add more in Notion → Settings → Connections → your Vocaweb integration → Access.'
                : undefined,
        };
      }
      if (provider === 'canva') {
        const designs = await listCanvaDesigns(user.userId);
        return { resources: designs };
      }
      if (provider === 'figma') {
        const url = (request.query as { url?: string }).url;
        const key = url ? extractFigmaFileKey(url) : null;
        if (!key) {
          return {
            resources: [],
            hint: 'Paste a Figma file URL to import (figma.com/file/... or figma.com/design/...)',
          };
        }
        return {
          resources: [{ id: key, title: key, url }],
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list resources';
      return reply.status(502).send({ error: message });
    }

    return reply.status(400).send({ error: 'Unknown provider' });
  });

  app.get('/canva/mcp/connect', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!isCanvaMcpOAuthConfigured()) {
      return reply.status(503).send({ error: 'Canva MCP OAuth not configured on server' });
    }

    const redirectAfter =
      (request.query as { redirect?: string }).redirect ?? `${getWebRedirectBase()}/settings`;

    const state = createCanvaMcpOAuthState(user.userId, redirectAfter);
    const authUrl = getCanvaMcpAuthUrl(state);
    return { authUrl };
  });

  app.get('/canva/mcp/callback', async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const redirectBase = getWebRedirectBase();
    if (error || !code || !state) {
      return reply.redirect(`${redirectBase}/settings?integration=mcp_error&provider=canva`);
    }

    try {
      const result = await completeCanvaMcpOAuth(state, code);
      const dest = result.redirectAfter ?? `${redirectBase}/settings`;
      return reply.redirect(`${dest}?integration=mcp_connected&provider=canva`);
    } catch (err) {
      app.log.error(err, 'Canva MCP OAuth callback failed');
      return reply.redirect(`${redirectBase}/settings?integration=mcp_error&provider=canva`);
    }
  });

  app.get('/canva/mcp/status', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rows = await listUserIntegrations(user.userId);
    const canva = rows.find((r) => r.provider === 'canva');
    return {
      connected: isCanvaMcpConnected(canva?.metadata),
      configured: isCanvaMcpOAuthConfigured(),
    };
  });

  app.post('/import', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = importRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { model } = request.body as { model?: ModelTier };

    try {
      const { bundle, mcpWarnings } = await runImportPipelineWithMeta(
        user.userId,
        parsed.data.sources,
        parsed.data.projectId,
        { useMcp: parsed.data.useMcp },
      );
      const plan = buildPlanFromImportBundle(bundle, model);
      return { bundle, plan, mcpWarnings };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      return reply.status(502).send({ error: message });
    }
  });

  app.post('/import/build', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = request.body as {
      sources?: import('@theo/shared').ImportSource[];
      projectId?: string;
      description?: string;
      useMcp?: boolean;
      model?: ModelTier;
    };

    const parsed = importRequestSchema.safeParse({
      sources: body.sources,
      projectId: body.projectId,
      useMcp: body.useMcp,
    });
    if (!parsed.success) {
      return reply.status(400).send({ error: 'sources array is required' });
    }

    try {
      const { bundle, mcpWarnings } = await runImportPipelineWithMeta(
        user.userId,
        parsed.data.sources,
        parsed.data.projectId,
        { useMcp: parsed.data.useMcp },
      );
      const description = mergeImportBundleIntoDescription(
        body.description ?? 'Build a website from my imported design sources.',
        bundle,
        body.model,
      );

      const build = await buildProjectFromDescription(description, {
        userId: user.userId,
        projectId: parsed.data.projectId,
        channel: 'chat',
        modelTier: body.model,
        confirmedPlan: buildPlanFromImportBundle(bundle, body.model),
        useMcp: parsed.data.useMcp,
      });

      return {
        bundle,
        plan: buildPlanFromImportBundle(bundle, body.model),
        mcpWarnings,
        buildResult: {
          projectId: build.projectId,
          filesGenerated: build.filesGenerated,
          skillsUsed: build.skillsUsed,
          files: build.files,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import build failed';
      return reply.status(502).send({ error: message });
    }
  });
}
