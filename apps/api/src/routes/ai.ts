import type { FastifyInstance, FastifyReply } from 'fastify';
import { getProjectFileTree, persistProjectToDb } from '../lib/project-manager.js';
import { getAllSkillFilenames } from '@theo/ai';
import { handleChat, handleImageGeneration } from '../lib/chat-handler.js';
import { getAuthUser, requireAuthUser } from '../lib/privy-auth.js';
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
import { verifyModelAccess, type ModelTier } from '../lib/token-gate.js';
import { getProject } from '@theo/db';

export async function aiRoutes(app: FastifyInstance) {
  const aiRateConfig = {
    config: {
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
  };

  app.post('/chat', aiRateConfig, async (request, reply) => {
    const { messages, sessionId, projectId, model, walletAddress } = request.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      sessionId?: string;
      projectId?: string;
      model?: ModelTier;
      walletAddress?: string;
    };

    if (!messages?.length) return reply.status(400).send({ error: 'messages array is required' });

    let authUser;
    try {
      authUser = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const requestedTier: ModelTier = model ?? 'v1';
    const gateResult = await verifyModelAccess(
      walletAddress ?? null,
      requestedTier,
      authUser.userId,
    );

    if (!gateResult.eligible) {
      return reply.status(403).send({
        error: 'access_denied',
        message: gateResult.message,
        tier: gateResult.tier,
        balance: gateResult.balance,
      });
    }

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

      // Standalone image requests — generate directly via OpenAI
      if (lastUser?.content) {
        const imageResult = await handleImageGeneration(lastUser.content);
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

    const buildTier: ModelTier = model ?? 'v1';
    const gateResult = await verifyModelAccess(null, buildTier, authUser.userId);
    if (!gateResult.eligible) {
      return reply.status(403).send({
        error: 'access_denied',
        message: gateResult.message,
        tier: gateResult.tier,
        balance: gateResult.balance,
      });
    }
    if (buildTier === 'v1') {
    }

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

      const buildReply =
        'Building your site — watch the live preview update. Your website is ready!';

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
      app.log.error(err, 'Direct build failed');
      const message = err instanceof Error ? err.message : 'Build failed';
      return reply.status(500).send({ error: message });
    }
  });

  /** SSE stream — emits progress then file events */
  app.post('/generate/stream', aiRateConfig, async (request, reply) => {
    const { description, projectId, channel = 'chat', sessionId, model, walletAddress } = request.body as {
      description: string;
      projectId?: string;
      channel?: 'chat' | 'voice';
      sessionId?: string;
      model?: ModelTier;
      walletAddress?: string;
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

    const requestedTier: ModelTier = model ?? 'v1';
    const gateResult = await verifyModelAccess(
      walletAddress ?? null,
      requestedTier,
      authUser.userId,
    );

    if (!gateResult.eligible) {
      return reply.status(403).send({
        error: 'access_denied',
        message: gateResult.message,
        tier: gateResult.tier,
        balance: gateResult.balance,
      });
    }

    if (requestedTier === 'v1') {
    }

    let dbSessionId = sessionId ?? null;

    if (!writeSseHeaders(request, reply)) return;

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
      const message = err instanceof Error ? err.message : 'Stream failed';
      sendSseEvent(reply, 'error', { message });
    }

    reply.raw.end();
  });

  app.post('/voice/action', aiRateConfig, async (request, reply) => {
    const { tool, args, projectId, transcript, model, walletAddress } = request.body as {
      tool: string;
      args?: Record<string, unknown>;
      projectId?: string;
      transcript?: string;
      model?: ModelTier;
      walletAddress?: string;
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

    const requestedTier: ModelTier = model ?? 'v1';
    const gateResult = await verifyModelAccess(
      walletAddress ?? null,
      requestedTier,
      authUser.userId,
    );

    if (!gateResult.eligible) {
      return reply.status(403).send({
        error: 'access_denied',
        message: gateResult.message,
        tier: gateResult.tier,
        balance: gateResult.balance,
      });
    }

    if (requestedTier === 'v1') {
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
      return result;
    } catch (err) {
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

    const genGateResult = await verifyModelAccess(null, 'v1', authUser.userId);
    if (!genGateResult.eligible) {
      return reply.status(403).send({
        error: 'access_denied',
        message: genGateResult.message,
        tier: genGateResult.tier,
        balance: genGateResult.balance,
      });
    }
    try {
      const build = await buildProjectFromDescription(prompt, {
        userId: authUser.userId,
        projectId,
        framework: framework ?? 'nextjs',
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
      app.log.error(err, 'UI improvement failed');
      const message = err instanceof Error ? err.message : 'UI improvement failed';
      return reply.status(500).send({ error: message });
    }
  });

  app.post('/image', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { prompt } = request.body as { prompt: string };
    if (!prompt?.trim()) return reply.status(400).send({ error: 'prompt is required' });

    try {
      await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return reply.status(500).send({ error: 'OPENAI_API_KEY not set' });

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: prompt.trim(),
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return reply.status(502).send({ error: `Image generation failed: ${err}` });
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

      if (!imageUrl) return reply.status(502).send({ error: 'No image returned' });

      return { imageUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      return reply.status(500).send({ error: message });
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
    const providers: { name: string; available: boolean; models: string[] }[] = [];

    providers.push({
      name: 'codex',
      available: !!process.env.CODEX_API_KEY,
      models: [process.env.CODEX_MODEL ?? 'gpt-5.5'],
    });

    providers.push({
      name: 'anthropic',
      available: !!process.env.ANTHROPIC_API_KEY,
      models: ['claude-sonnet-4-6'],
    });

    providers.push({
      name: 'google',
      available: !!(process.env.ANTIGRAVITY_API_KEY ?? process.env.GEMINI_API_KEY),
      models: ['gemini-2.5-flash'],
    });

    providers.push({
      name: 'openai-images',
      available: !!process.env.OPENAI_API_KEY,
      models: ['gpt-image-1'],
    });

    return { providers };
  });

  app.get('/jobs/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Job tracking not yet implemented' });
  });
}
