import type { FastifyInstance } from 'fastify';
import { requireAuthUser, getAuthUser } from '../lib/auth.js';
import { persistBulkChatSessions } from '../lib/conversation-store.js';
import {
  getCachedUserSessions,
  setCachedUserSessions,
  getCachedSessionMessages,
  setCachedSessionMessages,
  invalidateSessionCache,
} from '../lib/session-cache.js';
import {
  getUserChatSessions,
  getChatSession,
  getChatMessages,
  createChatSession,
  saveChatMessage,
  getUserVoiceSessions,
  getVoiceSession,
  getUserAiGenerations,
  getUserActivityFeed,
  linkChatSessionToProject,
  deleteChatSession,
  deleteVoiceSession,
  saveChatMessageIdempotent,
} from '@theo/db';

export async function conversationRoutes(app: FastifyInstance) {
  /** Unified activity feed: chat sessions, voice sessions, builds */
  app.get('/activity', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const feed = await getUserActivityFeed(user.userId);
    return feed;
  });

  /** List text chat sessions */
  app.get('/chat/sessions', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    let sessions = await getCachedUserSessions(user.userId);
    if (!sessions) {
      sessions = await getUserChatSessions(user.userId);
      await setCachedUserSessions(user.userId, sessions);
    }
    return { sessions };
  });

  /** Bulk sync local sessions to DB (idempotent) */
  app.post('/chat/sessions/bulk-sync', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessions } = request.body as {
      sessions: Array<{
        localId: string;
        title?: string;
        projectId?: string;
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          metadata?: Record<string, unknown>;
          clientMessageId?: string;
        }>;
      }>;
    };

    if (!sessions?.length) {
      return { mappings: [], synced: 0 };
    }

    const result = await persistBulkChatSessions(user.userId, sessions);
    return result;
  });

  /** Create a new chat session */
  app.post('/chat/sessions', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { title, projectId } = request.body as { title?: string; projectId?: string };
    const session = await createChatSession(user.userId, { title, mode: 'text', projectId });
    await invalidateSessionCache(user.userId);
    return { session };
  });

  /** Get messages for a chat session */
  app.get('/chat/sessions/:id', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const session = await getChatSession(id, user.userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    let messages = await getCachedSessionMessages(id);
    if (!messages) {
      messages = await getChatMessages(id);
      await setCachedSessionMessages(id, messages);
    }
    return { session, messages };
  });

  /** Delete a chat session */
  app.delete('/chat/sessions/:id', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const deleted = await deleteChatSession(id, user.userId);
    if (!deleted) return reply.status(404).send({ error: 'Session not found' });
    await invalidateSessionCache(user.userId, id);
    return { ok: true };
  });

  /** Append a message to a chat session */
  app.post('/chat/sessions/:id/messages', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const session = await getChatSession(id, user.userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const { role, content, metadata, projectId, clientMessageId } = request.body as {
      role: 'user' | 'assistant';
      content: string;
      metadata?: Record<string, unknown>;
      projectId?: string;
      clientMessageId?: string;
    };

    if (!role || !content) {
      return reply.status(400).send({ error: 'role and content are required' });
    }

    const message = clientMessageId
      ? await saveChatMessageIdempotent(id, role, content, metadata, clientMessageId)
      : await saveChatMessage(id, role, content, metadata);

    if (!message) {
      return { message: null, deduplicated: true };
    }

    if (projectId) await linkChatSessionToProject(id, projectId);
    await invalidateSessionCache(user.userId, id);
    return { message };
  });

  /** List voice sessions */
  app.get('/voice/sessions', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const sessions = await getUserVoiceSessions(user.userId);
    return { sessions };
  });

  /** Get a single voice session with transcript */
  app.get('/voice/sessions/:id', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const session = await getVoiceSession(id, user.userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { session };
  });

  /** Delete a voice session */
  app.delete('/voice/sessions/:id', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const deleted = await deleteVoiceSession(id, user.userId);
    if (!deleted) return reply.status(404).send({ error: 'Session not found' });
    return { ok: true };
  });

  /** List AI build generations */
  app.get('/builds', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const builds = await getUserAiGenerations(user.userId);
    return { builds };
  });
}
