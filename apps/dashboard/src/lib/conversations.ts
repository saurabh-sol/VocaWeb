'use client';

import { apiFetch } from './api';
import type { ChatMessage, ChatSession } from '@/store';

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

const OUTBOX_KEY = 'theo-sync-outbox';
const MAX_RETRIES = 3;

export interface SyncOutboxItem {
  id: string;
  type: 'chat' | 'voice';
  payload: Record<string, unknown>;
  retries: number;
  createdAt: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDbSessionId(id: string): boolean {
  if (id.startsWith('voice-')) {
    return UUID_RE.test(id.slice(6));
  }
  return UUID_RE.test(id);
}

export function makeClientMessageId(sessionId: string, index: number, role: string): string {
  return `${sessionId}:${index}:${role}`;
}

function readOutbox(): SyncOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as SyncOutboxItem[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: SyncOutboxItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export function enqueueSyncOutbox(item: Omit<SyncOutboxItem, 'id' | 'retries' | 'createdAt'>) {
  const outbox = readOutbox();
  outbox.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    retries: 0,
    createdAt: new Date().toISOString(),
  });
  writeOutbox(outbox);
}

export async function drainSyncOutbox(getToken: GetTokenFn): Promise<void> {
  const outbox = readOutbox();
  if (outbox.length === 0) return;

  const remaining: SyncOutboxItem[] = [];

  for (const item of outbox) {
    try {
      if (item.type === 'chat') {
        const { sessionId, role, content, metadata, projectId, clientMessageId } =
          item.payload as {
            sessionId: string | null;
            role: 'user' | 'assistant';
            content: string;
            metadata?: Record<string, unknown>;
            projectId?: string;
            clientMessageId?: string;
          };
        await syncChatMessageInternal(
          sessionId,
          role,
          content,
          getToken,
          metadata,
          projectId,
          clientMessageId,
        );
      } else if (item.type === 'voice') {
        const { sessionId, messages, projectId } = item.payload as {
          sessionId: string;
          messages: Array<{ role: string; text: string; timestamp?: string }>;
          projectId?: string;
        };
        await syncVoiceTranscriptInternal(sessionId, messages, getToken, projectId);
      }
    } catch {
      if (item.retries < MAX_RETRIES) {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }
  }

  writeOutbox(remaining);
}

async function syncChatMessageInternal(
  sessionId: string | null,
  role: 'user' | 'assistant',
  content: string,
  getToken: GetTokenFn,
  metadata?: Record<string, unknown>,
  projectId?: string,
  clientMessageId?: string,
): Promise<string | null> {
  let sid = sessionId;
  if (!sid) {
    const res = await apiFetch(
      '/conversations/chat/sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          title: content.slice(0, 50),
          projectId,
        }),
      },
      getToken,
    );
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    sid = data.session?.id ?? null;
  }
  if (!sid) throw new Error('No session id');

  const res = await apiFetch(
    `/conversations/chat/sessions/${sid}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ role, content, metadata, projectId, clientMessageId }),
    },
    getToken,
  );
  if (!res.ok) throw new Error('Failed to sync message');
  return sid;
}

async function syncVoiceTranscriptInternal(
  sessionId: string,
  messages: Array<{ role: string; text: string; timestamp?: string }>,
  getToken: GetTokenFn,
  projectId?: string,
): Promise<void> {
  const res = await apiFetch(
    '/voice/sessions/db/sync',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, messages, projectId }),
    },
    getToken,
  );
  if (!res.ok) throw new Error('Failed to sync voice transcript');
}

export async function syncChatMessage(
  sessionId: string | null,
  role: 'user' | 'assistant',
  content: string,
  getToken: GetTokenFn,
  metadata?: Record<string, unknown>,
  projectId?: string,
  clientMessageId?: string,
): Promise<string | null> {
  try {
    return await syncChatMessageInternal(
      sessionId,
      role,
      content,
      getToken,
      metadata,
      projectId,
      clientMessageId,
    );
  } catch {
    enqueueSyncOutbox({
      type: 'chat',
      payload: { sessionId, role, content, metadata, projectId, clientMessageId },
    });
    return sessionId;
  }
}

export async function deleteChatSessionOnServer(
  sessionId: string,
  getToken: GetTokenFn,
): Promise<boolean> {
  try {
    const res = await apiFetch(
      `/conversations/chat/sessions/${sessionId}`,
      { method: 'DELETE' },
      getToken,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteVoiceSessionOnServer(
  voiceDbId: string,
  getToken: GetTokenFn,
): Promise<boolean> {
  try {
    const res = await apiFetch(
      `/conversations/voice/sessions/${voiceDbId}`,
      { method: 'DELETE' },
      getToken,
    );
    return res.ok;
  } catch {
    return false;
  }
}

interface DbChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  project_id?: string | null;
}

interface DbChatMessage {
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

interface DbVoiceSession {
  id: string;
  started_at: string;
  project_id?: string | null;
  transcript?: { messages?: Array<{ role: string; text: string }> } | null;
}

export async function fetchUserActivity(getToken: GetTokenFn) {
  const res = await apiFetch('/conversations/activity', {}, getToken);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchChatSession(sessionId: string, getToken: GetTokenFn) {
  const res = await apiFetch(`/conversations/chat/sessions/${sessionId}`, {}, getToken);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchChatSessionsList(getToken: GetTokenFn): Promise<DbChatSession[]> {
  const res = await apiFetch('/conversations/chat/sessions', {}, getToken);
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions ?? [];
}

export async function fetchVoiceSessionsList(getToken: GetTokenFn): Promise<DbVoiceSession[]> {
  const res = await apiFetch('/conversations/voice/sessions', {}, getToken);
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions ?? [];
}

export function mapDbMessagesToChat(messages: DbChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    const meta = m.metadata ?? {};
    return {
      role: m.role as 'user' | 'assistant',
      text: m.content,
      ...(typeof meta.filesGenerated === 'number'
        ? { filesGenerated: meta.filesGenerated }
        : {}),
      ...(Array.isArray(meta.skillsUsed) ? { skillsUsed: meta.skillsUsed as string[] } : {}),
      ...(Array.isArray(meta.images) ? { images: meta.images as string[] } : {}),
      ...(typeof meta.plan === 'string' ? { plan: meta.plan } : {}),
    };
  });
}

export function mapDbChatSessionToSummary(session: DbChatSession): ChatSession {
  return {
    id: session.id,
    title: session.title || 'Chat',
    createdAt: session.created_at,
    messages: [],
    source: 'chat',
    projectId: session.project_id ?? null,
  };
}

export function mapVoiceSessionToChatSession(session: DbVoiceSession): ChatSession {
  const messages = (session.transcript?.messages ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    text: m.text,
  }));
  const firstUser = messages.find((m) => m.role === 'user');
  const title = firstUser
    ? firstUser.text.length > 50
      ? firstUser.text.slice(0, 50) + '...'
      : firstUser.text
    : 'Voice Session';

  return {
    id: `voice-${session.id}`,
    title,
    createdAt: session.started_at,
    messages,
    source: 'voice',
    projectId: session.project_id ?? null,
  };
}

export async function ensureSessionMessages(
  session: ChatSession,
  getToken: GetTokenFn,
): Promise<ChatSession> {
  if (session.messages.length > 0 || session.source !== 'chat') {
    return session;
  }

  const data = await fetchChatSession(session.id, getToken);
  if (!data?.messages) return session;

  const messages = mapDbMessagesToChat(data.messages);
  const projectId =
    session.projectId ?? (data.session?.project_id as string | null | undefined) ?? null;

  return { ...session, messages, projectId };
}

export async function loadProjectFilesForSession(
  projectId: string,
  getToken: GetTokenFn,
): Promise<Record<string, string> | null> {
  const res = await apiFetch(`/projects/${projectId}`, {}, getToken);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.files as Record<string, string>) ?? {};
}

export async function loadChatHistoryFromServer(
  getToken: GetTokenFn,
): Promise<ChatSession[]> {
  const [chatList, voiceList] = await Promise.all([
    fetchChatSessionsList(getToken),
    fetchVoiceSessionsList(getToken),
  ]);

  return [
    ...voiceList.map(mapVoiceSessionToChatSession),
    ...chatList.map(mapDbChatSessionToSummary),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function bulkSyncLocalSessions(
  sessions: ChatSession[],
  getToken: GetTokenFn,
): Promise<Array<{ localId: string; dbSessionId: string }>> {
  const toSync = sessions.filter(
    (s) =>
      s.source !== 'voice' &&
      s.messages.length > 0 &&
      (s.source === 'local' || !isDbSessionId(s.id)),
  );

  if (toSync.length === 0) return [];

  const payload = {
    sessions: toSync.map((s) => ({
      localId: s.id,
      title: s.title,
      projectId: s.projectId ?? undefined,
      messages: s.messages.map((m, i) => ({
        role: m.role,
        content: m.text,
        clientMessageId: makeClientMessageId(s.id, i, m.role),
        metadata: {
          ...(m.filesGenerated != null ? { filesGenerated: m.filesGenerated } : {}),
          ...(m.skillsUsed ? { skillsUsed: m.skillsUsed } : {}),
          ...(m.images ? { images: m.images } : {}),
          ...(m.plan ? { plan: m.plan } : {}),
        },
      })),
    })),
  };

  const res = await apiFetch(
    '/conversations/chat/sessions/bulk-sync',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    getToken,
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.mappings ?? []) as Array<{ localId: string; dbSessionId: string }>;
}

export async function startVoiceSession(getToken: GetTokenFn, projectId?: string) {
  const res = await apiFetch(
    '/voice/sessions/db',
    {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    },
    getToken,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.sessionId as string | null;
}

export async function syncVoiceTranscript(
  sessionId: string,
  messages: Array<{ role: string; text: string; timestamp?: string }>,
  getToken: GetTokenFn,
  projectId?: string,
) {
  try {
    await syncVoiceTranscriptInternal(sessionId, messages, getToken, projectId);
  } catch {
    enqueueSyncOutbox({
      type: 'voice',
      payload: { sessionId, messages, projectId },
    });
  }
}

export async function endVoiceSession(sessionId: string, getToken: GetTokenFn, durationSeconds = 0) {
  try {
    await apiFetch(
      '/voice/sessions/db/end',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, durationSeconds }),
      },
      getToken,
    );
  } catch {
    /* non-fatal */
  }
}

export async function syncAuthUser(getToken: GetTokenFn): Promise<void> {
  try {
    await apiFetch('/auth/sync', { method: 'POST' }, getToken);
  } catch {
    /* non-fatal */
  }
}
