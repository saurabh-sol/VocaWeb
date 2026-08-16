import {
  createChatSession,
  saveChatMessage,
  saveChatMessageIdempotent,
  linkChatSessionToProject,
  updateChatSessionTitle,
  createVoiceSession,
  updateVoiceSessionTranscript,
  endVoiceSession,
  logAiGeneration,
  bulkSyncChatSessions,
  type BulkSyncSessionInput,
} from '@theo/db';
import { invalidateSessionCache } from './session-cache.js';

let dbOk: boolean | null = null;

async function canUseDb(): Promise<boolean> {
  if (dbOk === false) return false;
  if (dbOk === true) return true;
  try {
    if (!process.env.DATABASE_URL) {
      dbOk = false;
      return false;
    }
    dbOk = true;
    return true;
  } catch {
    dbOk = false;
    return false;
  }
}

export async function persistChatMessage(
  userId: string,
  sessionId: string | null,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>,
  options?: {
    title?: string;
    projectId?: string;
    clientMessageId?: string;
  },
): Promise<string | null> {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) return sessionId;

  try {
    let sid = sessionId;
    if (!sid) {
      const session = await createChatSession(userId, {
        title: options?.title ?? (content.slice(0, 50) || 'New Chat'),
        mode: 'text',
        projectId: options?.projectId,
      });
      sid = session.id;
    }

    if (options?.clientMessageId) {
      await saveChatMessageIdempotent(
        sid,
        role,
        content,
        metadata,
        options.clientMessageId,
      );
    } else {
      await saveChatMessage(sid, role, content, metadata);
    }

    if (options?.projectId) {
      await linkChatSessionToProject(sid, options.projectId);
    }

    await invalidateSessionCache(userId, sid);
    return sid;
  } catch (err) {
    console.error('[conversations] persistChatMessage failed:', err);
    return sessionId;
  }
}

export async function persistBulkChatSessions(
  userId: string,
  sessions: BulkSyncSessionInput[],
) {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) {
    return { mappings: [], synced: 0 };
  }
  try {
    const result = await bulkSyncChatSessions(userId, sessions);
    await invalidateSessionCache(userId);
    return result;
  } catch (err) {
    console.error('[conversations] persistBulkChatSessions failed:', err);
    return { mappings: [], synced: 0 };
  }
}

export async function persistChatSessionLink(
  sessionId: string,
  projectId: string,
  title?: string,
  userId?: string,
): Promise<void> {
  if (!(await canUseDb())) return;
  try {
    await linkChatSessionToProject(sessionId, projectId);
    if (title) await updateChatSessionTitle(sessionId, title);
    if (userId) await invalidateSessionCache(userId, sessionId);
  } catch (err) {
    console.error('[conversations] persistChatSessionLink failed:', err);
  }
}

export async function startVoiceSessionDb(
  userId: string,
  projectId?: string,
): Promise<string | null> {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) return null;
  try {
    const session = await createVoiceSession(userId, projectId);
    return session.id;
  } catch (err) {
    console.error('[conversations] startVoiceSessionDb failed:', err);
    return null;
  }
}

export async function persistVoiceTranscriptDb(
  userId: string,
  sessionId: string,
  messages: Array<{ role: string; text: string; timestamp?: string }>,
  projectId?: string,
): Promise<void> {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) return;
  try {
    await updateVoiceSessionTranscript(sessionId, userId, messages, projectId);
  } catch (err) {
    console.error('[conversations] persistVoiceTranscriptDb failed:', err);
  }
}

export async function finalizeVoiceSessionDb(
  userId: string,
  sessionId: string,
  durationSeconds = 0,
): Promise<void> {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) return;
  try {
    await endVoiceSession(sessionId, userId, durationSeconds);
  } catch (err) {
    console.error('[conversations] finalizeVoiceSessionDb failed:', err);
  }
}

export async function persistBuildLog(
  userId: string,
  projectId: string,
  jobType: string,
  model: string,
  result?: Record<string, unknown>,
  tokens?: { input?: number; output?: number },
): Promise<void> {
  if (!userId || userId === 'anonymous' || !(await canUseDb())) return;
  try {
    await logAiGeneration({
      userId,
      projectId,
      jobType,
      model,
      inputTokens: tokens?.input,
      outputTokens: tokens?.output,
      result,
      status: 'completed',
    });
  } catch (err) {
    console.error('[conversations] persistBuildLog failed:', err);
  }
}
