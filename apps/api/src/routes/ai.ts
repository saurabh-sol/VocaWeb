import type { FastifyInstance, FastifyReply } from 'fastify';
import { getProjectFileTree, persistProjectToDb } from '../lib/project-manager.js';
import { getAllSkillFilenames } from '@theo/ai';
import { handleChat, handleImageGeneration } from '../lib/chat-handler.js';
import { isStandaloneImageRequest } from '../lib/image-generator.js';
import { getAuthUser, requireAuthUser } from '../lib/auth.js';
import { executeVoiceAction } from '../lib/voice-action.js';
import { buildProjectFromDescription, fixProjectError } from '../lib/build-helper.js';
import { autoFixBuildError } from '../lib/build-verifier.js';
import { persistChatMessage, persistChatSessionLink } from '../lib/conversation-store.js';
import { writeSseHeaders, sendSseEvent } from '../lib/sse.js';
import {
  buildStructuredBuildDescription,
  extractPlanFromMessages,
} from '../lib/conversation-context.js';
import { runAgenticCodegen } from '../lib/agent-loop.js';
import { checkTier, type ModelTier, type TierCheck } from '../lib/model-tier.js';
import { reserveBuild, UsageLimitError } from '../lib/usage.js';
import { toGatewayModelId, GATEWAY_BASE_URL } from '@theo/ai';
import { getGatewayKey, hasGatewayKey } from '../lib/ai-keys.js';
import { getProject } from '@theo/db';

function sendTierDenied(reply: FastifyReply, check: TierCheck) {
  return reply.status(403).send({
    error: 'access_denied',
    message: check.message,
    tier: check.tier,
  });
}

function sendLimitReached(reply: FastifyReply, err: UsageLimitError) {
  return reply.status(429).send({
    error: 'limit_reached',
    message: err.message,
    usage: err.usage,
  });
}

/** Takes one build from the allowance, or answers 429 and returns null. */
async function reserveOrReply(userId: string, reply: FastifyReply) {
  try {
    return await reserveBuild(userId);
  } catch (err) {
    if (err instanceof UsageLimitError) {
      sendLimitReached(reply, err);
      return null;
    }
    throw err;
  }
}

export async function aiRoutes(app: FastifyInstance) {
  const aiRateConfig = {
    config: {
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
  };

  app.post('/chat', aiRateConfig, async (request, reply) => {
    const { messages, sessionId, projectId, model } = request.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      sessionId?: string;
      projectId?: string;
      model?: ModelTier;
    };

    if (!messages?.length) return reply.status(400).send({ error: 'messages array is required' });

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const tierCheck = checkTier(model);
    if (!tierCheck.eligible) return sendTierDenied(reply, tierCheck);
    const requestedTier = tierCheck.tier;

    let refund: (() => Promise<void>) | null = null;

    try {
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      let dbSessionId = sessionId ?? null;

      if (authUser && lastUser) {
        dbSessionId = await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'user',
          lastUser.content,
          undefined,
          { projectId },
        );
      }

      // Standalone image requests are generated straight away and count as one build.
      if (lastUser?.content && isStandaloneImageRequest(lastUser.content)) {
        refund = await reserveOrReply(authUser.userId, reply);
        if (!refund) return reply;
        const imageResult = await handleImageGeneration(lastUser.content);
        if (imageResult && !imageResult.images?.length) await refund();
        if (imageResult) {
          if (authUser && dbSessionId) {
            await persistChatMessage(
              authUser.userId,
              dbSessionId,
              'assistant',
              imageResult.reply,
              imageResult.images?.length ? { images: imageResult.images } : undefined,
            );
          }
          return {
            intent: imageResult.intent,
            reply: imageResult.reply,
            shouldBuild: false,
            images: imageResult.images,
            sessionId: dbSessionId,
          };
        }
      }

      const chatResult = await handleChat(messages, { modelTier: requestedTier });

      if (authUser && dbSessionId) {
        const meta: Record<string, unknown> = {};
        if (chatResult.plan) meta.plan = chatResult.plan;
        if (chatResult.images?.length) meta.images = chatResult.images;
        await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'assistant',
          chatResult.reply,
          Object.keys(meta).length ? meta : undefined,
        );
      }

      if (chatResult.intent === 'plan_ready' && chatResult.plan) {
        return {
          intent: chatResult.intent,
          reply: chatResult.reply,
          shouldBuild: false,
          plan: chatResult.plan,
          sessionId: dbSessionId,
        };
      }

      if (chatResult.intent === 'import_sources') {
        return {
          intent: chatResult.intent,
          reply: chatResult.reply,
          shouldBuild: false,
          showImportModal: true,
          sessionId: dbSessionId,
        };
      }

      if (chatResult.shouldBuild) {
        refund = await reserveOrReply(authUser.userId, reply);
        if (!refund) return reply;

        const confirmedPlan = chatResult.plan ?? extractPlanFromMessages(messages);
        const buildDescription = buildStructuredBuildDescription(messages, confirmedPlan);

        const build = await buildProjectFromDescription(buildDescription, {
          userId: authUser.userId,
          channel: 'chat',
          modelTier: requestedTier,
          conversationHistory: messages,
          confirmedPlan,
        });

        if (authUser && dbSessionId) {
          await persistChatSessionLink(dbSessionId, build.projectId, undefined, authUser.userId);
        }

        const buildSummary =
          chatResult.reply?.replace('[BUILD_READY]', '').trim() ||
          'Your website is ready! Opening the live preview now.';

        return {
          intent: chatResult.intent,
          reply: buildSummary,
          shouldBuild: true,
          sessionId: dbSessionId,
          buildResult: {
            projectId: build.projectId,
            provider: build.provider,
            model: build.model,
            skillsUsed: build.skillsUsed,
            filesGenerated: build.filesGenerated,
            files: build.files,
            applied: build.applied,
            errors: build.errors,
          },
        };
      }

      return {
        intent: chatResult.intent,
        reply: chatResult.reply,
        shouldBuild: false,
        sessionId: dbSessionId,
        images: chatResult.images,
      };
    } catch (err) {
      await refund?.();
      app.log.error(err, 'Chat failed');
      const message = err instanceof Error ? err.message : 'Chat failed';
      return reply.status(500).send({ error: message });
    }
  });

  /** Direct build — skips chat LLM (used on "Build This" confirm) */
  app.post('/build', aiRateConfig, async (request, reply) => {
    const { description, plan, projectId, messages, sessionId, model } = request.body as {
      description?: string;
      plan?: string;
      projectId?: string;
      messages?: { role: 'user' | 'assistant'; content: string }[];
      sessionId?: string;
      model?: ModelTier;
    };

    const confirmedPlan = plan?.trim();
    const prompt = confirmedPlan
      ? buildStructuredBuildDescription(messages ?? [], confirmedPlan)
      : (plan ?? description ?? '').trim();
    if (!prompt) {
      return reply.status(400).send({ error: 'description or plan is required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (projectId) {
      const project = await getProject(projectId).catch(() => null);
      if (project && project.user_id !== authUser.userId) {
        return reply.status(403).send({ error: 'You do not own this project' });
      }
    }

    const tierCheck = checkTier(model);
    if (!tierCheck.eligible) return sendTierDenied(reply, tierCheck);
    const buildTier = tierCheck.tier;

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    let dbSessionId = sessionId ?? null;

    try {
      const lastUser = messages?.filter((m) => m.role === 'user').pop();
      if (lastUser) {
        dbSessionId = await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'user',
          lastUser.content,
          undefined,
          { projectId },
        );
      }

      const build = await buildProjectFromDescription(prompt, {
        userId: authUser.userId,
        projectId,
        channel: 'chat',
        modelTier: buildTier,
        conversationHistory: messages,
        confirmedPlan,
      });

      const buildReply = 'Your website is ready. The live preview is open.';

      if (authUser && dbSessionId) {
        await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'assistant',
          buildReply,
          {
            filesGenerated: build.filesGenerated,
            skillsUsed: build.skillsUsed,
          },
        );
        await persistChatSessionLink(dbSessionId, build.projectId, undefined, authUser.userId);
      }

      return {
        shouldBuild: true,
        reply: buildReply,
        sessionId: dbSessionId,
        buildResult: {
          projectId: build.projectId,
          provider: build.provider,
          model: build.model,
          skillsUsed: build.skillsUsed,
          filesGenerated: build.filesGenerated,
          files: build.files,
          applied: build.applied,
          errors: build.errors,
        },
      };
    } catch (err) {
      await refund();
      app.log.error(err, 'Direct build failed');
      const message = err instanceof Error ? err.message : 'Build failed';
      return reply.status(500).send({ error: message });
    }
  });

  /** SSE stream — emits progress then file events */
  app.post('/generate/stream', aiRateConfig, async (request, reply) => {
    const { description, projectId, channel = 'chat', sessionId, model } = request.body as {
      description: string;
      projectId?: string;
      channel?: 'chat' | 'voice';
      sessionId?: string;
      model?: ModelTier;
    };

    if (!description?.trim()) {
      return reply.status(400).send({ error: 'description is required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (projectId) {
      const project = await getProject(projectId).catch(() => null);
      if (project && project.user_id !== authUser.userId) {
        return reply.status(403).send({ error: 'You do not own this project' });
      }
    }

    const tierCheck = checkTier(model);
    if (!tierCheck.eligible) return sendTierDenied(reply, tierCheck);
    const requestedTier = tierCheck.tier;

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    let dbSessionId = sessionId ?? null;

    if (!writeSseHeaders(request, reply)) {
      await refund();
      return;
    }

    try {
      if (authUser) {
        dbSessionId = await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'user',
          description.trim(),
          undefined,
          { projectId },
        );
      }

      sendSseEvent(reply, 'progress', { stage: 'generating', message: 'Generating your website...' });

      const build = await buildProjectFromDescription(description.trim(), {
        userId: authUser.userId,
        projectId,
        channel: channel === 'voice' ? 'voice' : 'chat',
        modelTier: requestedTier,
      });

      for (const [path, content] of Object.entries(build.files)) {
        sendSseEvent(reply, 'file', { path, content });
      }

      const buildSummary = `Generated ${build.filesGenerated} files for your website.`;

      if (authUser && dbSessionId) {
        await persistChatMessage(
          authUser.userId,
          dbSessionId,
          'assistant',
          buildSummary,
          {
            filesGenerated: build.filesGenerated,
            skillsUsed: build.skillsUsed,
          },
        );
        await persistChatSessionLink(dbSessionId, build.projectId, undefined, authUser?.userId);
      }

      sendSseEvent(reply, 'done', {
        projectId: build.projectId,
        filesGenerated: build.filesGenerated,
        skillsUsed: build.skillsUsed,
        sessionId: dbSessionId,
      });
    } catch (err) {
      await refund();
      app.log.error(err, 'Streamed build failed');
      const message = err instanceof Error ? err.message : 'Stream failed';
      sendSseEvent(reply, 'error', { message });
    }

    reply.raw.end();
  });

  app.post('/voice/action', aiRateConfig, async (request, reply) => {
    const { tool, args, projectId, transcript, model } = request.body as {
      tool: string;
      args?: Record<string, unknown>;
      projectId?: string;
      transcript?: string;
      model?: ModelTier;
    };

    if (!tool) {
      return reply.status(400).send({ error: 'tool is required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (projectId) {
      const project = await getProject(projectId).catch(() => null);
      if (project && project.user_id !== authUser.userId) {
        return reply.status(403).send({ error: 'You do not own this project' });
      }
    }

    const tierCheck = checkTier(model);
    if (!tierCheck.eligible) return sendTierDenied(reply, tierCheck);
    const requestedTier = tierCheck.tier;

    let refund: (() => Promise<void>) | null = null;
    try {
      refund = await reserveBuild(authUser.userId);
    } catch (err) {
      if (err instanceof UsageLimitError) {
        // Voice reads this message back to the user, so keep the normal response shape.
        return { success: false, message: err.message };
      }
      throw err;
    }

    try {
      const result = await executeVoiceAction({
        tool,
        args: args ?? {},
        projectId,
        transcript,
        userId: authUser.userId,
        modelTier: requestedTier,
      });
      if (!result.success) await refund();
      return result;
    } catch (err) {
      await refund();
      app.log.error(err, 'Voice action failed');
      const message = err instanceof Error ? err.message : 'Voice action failed';
      return reply.status(500).send({
        success: false,
        message: `Build failed: ${message}`,
      });
    }
  });

  app.post('/fix', aiRateConfig, async (request, reply) => {
    const { projectId, error: errorMsg, channel = 'chat', autoFix = false } =
      request.body as {
        projectId: string;
        error: string;
        channel?: 'chat' | 'voice';
        autoFix?: boolean;
      };

    if (!projectId || !errorMsg) {
      return reply.status(400).send({ error: 'projectId and error are required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const userId = authUser.userId;

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    try {
      if (autoFix) {
        const result = await autoFixBuildError(
          projectId,
          errorMsg,
          userId,
          channel,
        );
        return {
          fixed: result.fixed,
          files: result.files ?? getProjectFileTree(projectId),
          attempts: result.attempts,
        };
      }

      const result = await fixProjectError(projectId, errorMsg, userId, channel);
      return {
        fixed: result.applied > 0,
        files: result.files,
        applied: result.applied,
        errors: result.errors,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fix failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/generate', aiRateConfig, async (request, reply) => {
    const { prompt, projectId, framework, provider } = request.body as {
      prompt: string;
      projectId?: string;
      framework?: string;
      provider?: 'anthropic' | 'google';
    };

    if (!prompt) return reply.status(400).send({ error: 'prompt is required' });

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (projectId) {
      const project = await getProject(projectId).catch(() => null);
      if (project && project.user_id !== authUser.userId) {
        return reply.status(403).send({ error: 'You do not own this project' });
      }
    }

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    try {
      // Only v1 is open, so the requested framework is ignored in favour of the v1 stack.
      void framework;
      const build = await buildProjectFromDescription(prompt, {
        userId: authUser.userId,
        projectId,
        modelTier: 'v1',
        channel: 'chat',
      });

      return {
        projectId: build.projectId,
        provider: build.provider,
        model: build.model,
        skillsUsed: build.skillsUsed,
        result: { operations: [], dependencies: [], buildCommand: 'npm run build' },
        applied: build.applied,
        errors: build.errors,
        files: build.files,
      };
    } catch (err) {
      await refund();
      app.log.error(err, 'Generation failed');
      const message = err instanceof Error ? err.message : 'Generation failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/edit', aiRateConfig, async (request, reply) => {
    const { instruction, projectId, targetFiles, provider } = request.body as {
      instruction: string;
      projectId: string;
      targetFiles?: string[];
      provider?: 'anthropic' | 'google';
    };

    if (!instruction || !projectId) {
      return reply.status(400).send({ error: 'instruction and projectId are required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== authUser.userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    try {
      let projectFiles = getProjectFileTree(projectId);
      if (targetFiles?.length) {
        projectFiles = Object.fromEntries(
          Object.entries(projectFiles).filter(([path]) => targetFiles.includes(path)),
        );
      }

      const result = await runAgenticCodegen(
        'edit_code',
        { instruction },
        {
          userId: authUser.userId,
          projectId,
          projectFiles,
          preferredProvider: provider,
          channel: 'chat',
        },
      );

      if (authUser) {
        await persistProjectToDb(projectId, authUser.userId);
      }
      return {
        ...result,
        applied: result.applied,
        errors: result.applyErrors,
        files: result.files,
      };
    } catch (err) {
      await refund();
      app.log.error(err, 'Edit failed');
      const message = err instanceof Error ? err.message : 'Edit failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/fix-legacy', aiRateConfig, async (request, reply) => {
    const { error: errorMsg, projectId, provider } = request.body as {
      error: string;
      projectId: string;
      provider?: 'anthropic' | 'google';
    };

    if (!errorMsg || !projectId) {
      return reply.status(400).send({ error: 'error and projectId are required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== authUser.userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    try {
      const result = await fixProjectError(
        projectId,
        errorMsg,
        authUser.userId,
        'chat',
      );
      return {
        ...result,
        files: result.files,
      };
    } catch (err) {
      app.log.error(err, 'Fix failed');
      const message = err instanceof Error ? err.message : 'Fix failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/improve', aiRateConfig, async (request, reply) => {
    const { instruction, projectId, targetFiles, provider } = request.body as {
      instruction: string;
      projectId: string;
      targetFiles?: string[];
      provider?: 'anthropic' | 'google';
    };

    if (!instruction || !projectId) {
      return reply.status(400).send({ error: 'instruction and projectId are required' });
    }

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const project = await getProject(projectId).catch(() => null);
    if (project && project.user_id !== authUser.userId) {
      return reply.status(403).send({ error: 'You do not own this project' });
    }

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    try {
      let projectFiles = getProjectFileTree(projectId);
      if (targetFiles?.length) {
        projectFiles = Object.fromEntries(
          Object.entries(projectFiles).filter(([path]) => targetFiles.includes(path)),
        );
      }

      const result = await runAgenticCodegen(
        'ui_improve',
        { instruction },
        {
          userId: authUser.userId,
          projectId,
          projectFiles,
          preferredProvider: provider,
          channel: 'chat',
        },
      );

      if (authUser) {
        await persistProjectToDb(projectId, authUser.userId);
      }
      return {
        ...result,
        applied: result.applied,
        errors: result.applyErrors,
        files: result.files,
      };
    } catch (err) {
      await refund();
      app.log.error(err, 'UI improvement failed');
      const message = err instanceof Error ? err.message : 'UI improvement failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/image', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { prompt } = request.body as { prompt: string };
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt is required' });

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const refund = await reserveOrReply(authUser.userId, reply);
    if (!refund) return reply;

    try {
      const response = await fetch(`${GATEWAY_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getGatewayKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: toGatewayModelId('gpt-image-1'),
          prompt: prompt.trim(),
          n: 1,
          size: '1024x1024',
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        await refund();
        app.log.error({ status: response.status, body: (await response.text()).slice(0, 300) }, 'Image generation failed');
        return reply.status(502).send({ error: 'Image generation failed. Please try again.' });
      }

      const data = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };

      const item = data.data?.[0];
      let imageUrl = '';
      if (item?.b64_json) {
        imageUrl = `data:image/png;base64,${item.b64_json}`;
      } else if (item?.url) {
        imageUrl = item.url;
      }

      if (!imageUrl) {
        await refund();
        return reply.status(502).send({ error: 'No image returned' });
      }

      return { imageUrl };
    } catch (err) {
      await refund();
      app.log.error(err, 'Image generation failed');
      return reply.status(500).send({ error: 'Image generation failed. Please try again.' });
    }
  });

  app.get('/skills', async () => {
    const filenames = getAllSkillFilenames();
    return {
      count: filenames.length,
      skills: filenames.map((f) => f.replace('.md', '')),
    };
  });

  app.get('/providers', async () => {
    const available = hasGatewayKey();
    return {
      gateway: 'vercel-ai-gateway',
      providers: [
        { name: 'google', available, models: ['gemini-2.5-flash'] },
        { name: 'anthropic', available, models: ['claude-sonnet-4-6'] },
        { name: 'openai', available, models: ['gpt-5.5'] },
        { name: 'openai-images', available, models: ['gpt-image-1'] },
      ],
    };
  });

  app.get('/jobs/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Job tracking not yet implemented' });
  });
}
