import { sql } from '../client.js';

export interface ChatSessionRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  mode: string;
  local_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  client_message_id: string | null;
  created_at: string;
}

export interface BulkSyncSessionInput {
  localId: string;
  title?: string;
  projectId?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    metadata?: Record<string, unknown>;
    clientMessageId?: string;
  }>;
}

export interface BulkSyncResult {
  mappings: Array<{ localId: string; dbSessionId: string }>;
  synced: number;
}

export interface VoiceSessionRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  transcript: { messages?: Array<{ role: string; text: string; timestamp?: string }> } | null;
  token_usage: Record<string, unknown> | null;
}

export interface AiGenerationRecord {
  id: string;
  user_id: string;
  project_id: string;
  job_type: string;
  model: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createChatSession(
  userId: string,
  options: { title?: string; mode?: 'text' | 'voice'; projectId?: string } = {},
): Promise<ChatSessionRecord> {
  const { title = 'New Chat', mode = 'text', projectId = null } = options;
  const rows = await sql`
    INSERT INTO chat_sessions (user_id, title, mode, project_id)
    VALUES (${userId}, ${title}, ${mode}, ${projectId})
    RETURNING *
  `;
  return rows[0] as ChatSessionRecord;
}

export async function getChatSession(
  sessionId: string,
  userId: string,
): Promise<ChatSessionRecord | null> {
  const rows = await sql`
    SELECT * FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;
  return (rows[0] as ChatSessionRecord) ?? null;
}

export async function getUserChatSessions(userId: string, limit = 50): Promise<ChatSessionRecord[]> {
  const rows = await sql`
    SELECT * FROM chat_sessions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows as ChatSessionRecord[];
}

export async function updateChatSessionTitle(sessionId: string, title: string): Promise<void> {
  await sql`
    UPDATE chat_sessions SET title = ${title}, updated_at = now()
    WHERE id = ${sessionId}
  `;
}

export async function linkChatSessionToProject(sessionId: string, projectId: string): Promise<void> {
  await sql`
    UPDATE chat_sessions SET project_id = ${projectId}, updated_at = now()
    WHERE id = ${sessionId}
  `;
}

export async function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>,
  clientMessageId?: string,
): Promise<ChatMessageRecord> {
  const rows = await sql`
    INSERT INTO chat_messages (session_id, role, content, metadata, client_message_id)
    VALUES (${sessionId}, ${role}, ${content}, ${metadata ?? null}, ${clientMessageId ?? null})
    RETURNING *
  `;
  await sql`UPDATE chat_sessions SET updated_at = now() WHERE id = ${sessionId}`;
  return rows[0] as ChatMessageRecord;
}

export async function saveChatMessageIdempotent(
  sessionId: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>,
  clientMessageId?: string,
): Promise<ChatMessageRecord | null> {
  if (clientMessageId) {
    const rows = await sql`
      INSERT INTO chat_messages (session_id, role, content, metadata, client_message_id)
      VALUES (${sessionId}, ${role}, ${content}, ${metadata ?? null}, ${clientMessageId})
      ON CONFLICT (session_id, client_message_id) WHERE client_message_id IS NOT NULL
      DO NOTHING
      RETURNING *
    `;
    if (rows.length > 0) {
      await sql`UPDATE chat_sessions SET updated_at = now() WHERE id = ${sessionId}`;
      return rows[0] as ChatMessageRecord;
    }
    return null;
  }
  return saveChatMessage(sessionId, role, content, metadata);
}

export async function getChatSessionByLocalId(
  userId: string,
  localSessionId: string,
): Promise<ChatSessionRecord | null> {
  const rows = await sql`
    SELECT * FROM chat_sessions
    WHERE user_id = ${userId} AND local_session_id = ${localSessionId}
    LIMIT 1
  `;
  return (rows[0] as ChatSessionRecord) ?? null;
}

export async function bulkSyncChatSessions(
  userId: string,
  sessions: BulkSyncSessionInput[],
): Promise<BulkSyncResult> {
  const mappings: Array<{ localId: string; dbSessionId: string }> = [];
  let synced = 0;

  for (const session of sessions) {
    if (!session.messages?.length) continue;

    let dbSession = await getChatSessionByLocalId(userId, session.localId);

    if (!dbSession) {
      const title =
        session.title?.trim() ||
        session.messages.find((m) => m.role === 'user')?.content.slice(0, 50) ||
        'New Chat';
      const rows = await sql`
        INSERT INTO chat_sessions (user_id, title, mode, project_id, local_session_id)
        VALUES (${userId}, ${title}, 'text', ${session.projectId ?? null}, ${session.localId})
        RETURNING *
      `;
      dbSession = rows[0] as ChatSessionRecord;
    } else if (session.projectId) {
      await linkChatSessionToProject(dbSession.id, session.projectId);
    }

    for (const msg of session.messages) {
      const clientMessageId =
        msg.clientMessageId ?? `${session.localId}:${msg.role}:${msg.content.slice(0, 32)}`;
      const inserted = await saveChatMessageIdempotent(
        dbSession.id,
        msg.role,
        msg.content,
        msg.metadata,
        clientMessageId,
      );
      if (inserted) synced++;
    }

    mappings.push({ localId: session.localId, dbSessionId: dbSession.id });
  }

  return { mappings, synced };
}

export async function deleteChatSession(sessionId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM chat_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteVoiceSession(sessionId: string, userId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM voice_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getUserChatSessionsWithMessageCounts(
  userId: string,
  limit = 50,
): Promise<Array<ChatSessionRecord & { message_count: number }>> {
  const rows = await sql`
    SELECT cs.*,
           (SELECT COUNT(*)::int FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count
    FROM chat_sessions cs
    WHERE cs.user_id = ${userId}
    ORDER BY cs.updated_at DESC
    LIMIT ${limit}
  `;
  return rows as Array<ChatSessionRecord & { message_count: number }>;
}

export async function getChatMessages(sessionId: string): Promise<ChatMessageRecord[]> {
  const rows = await sql`
    SELECT * FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;
  return rows as ChatMessageRecord[];
}

export async function createVoiceSession(
  userId: string,
  projectId?: string,
): Promise<VoiceSessionRecord> {
  const rows = await sql`
    INSERT INTO voice_sessions (user_id, project_id, transcript)
    VALUES (${userId}, ${projectId ?? null}, ${JSON.stringify({ messages: [] })})
    RETURNING *
  `;
  return rows[0] as VoiceSessionRecord;
}

export async function updateVoiceSessionTranscript(
  sessionId: string,
  userId: string,
  messages: Array<{ role: string; text: string; timestamp?: string }>,
  projectId?: string,
): Promise<void> {
  const transcript = {
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp ?? new Date().toISOString(),
    })),
  };
  if (projectId) {
    await sql`
      UPDATE voice_sessions
      SET transcript = ${JSON.stringify(transcript)},
          project_id = ${projectId}
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;
  } else {
    await sql`
      UPDATE voice_sessions
      SET transcript = ${JSON.stringify(transcript)}
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;
  }
}

export async function endVoiceSession(
  sessionId: string,
  userId: string,
  durationSeconds = 0,
): Promise<void> {
  await sql`
    UPDATE voice_sessions
    SET ended_at = now(), duration_seconds = ${durationSeconds}
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;
}

export async function getUserVoiceSessions(userId: string, limit = 50): Promise<VoiceSessionRecord[]> {
  const rows = await sql`
    SELECT * FROM voice_sessions
    WHERE user_id = ${userId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return rows as VoiceSessionRecord[];
}

export async function getVoiceSession(
  sessionId: string,
  userId: string,
): Promise<VoiceSessionRecord | null> {
  const rows = await sql`
    SELECT * FROM voice_sessions
    WHERE id = ${sessionId} AND user_id = ${userId}
  `;
  return (rows[0] as VoiceSessionRecord) ?? null;
}

export async function logAiGeneration(input: {
  userId: string;
  projectId: string;
  jobType: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  status?: string;
  result?: Record<string, unknown>;
  error?: string;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO ai_generations (
      user_id, project_id, job_type, model, status,
      input_tokens, output_tokens, result, error, completed_at
    )
    VALUES (
      ${input.userId},
      ${input.projectId},
      ${input.jobType},
      ${input.model},
      ${input.status ?? 'completed'},
      ${input.inputTokens ?? 0},
      ${input.outputTokens ?? 0},
      ${input.result ? JSON.stringify(input.result) : null},
      ${input.error ?? null},
      now()
    )
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}

export async function getUserAiGenerations(userId: string, limit = 50): Promise<AiGenerationRecord[]> {
  const rows = await sql`
    SELECT id, user_id, project_id, job_type, model, status,
           input_tokens, output_tokens, result, error, created_at, completed_at
    FROM ai_generations
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows as AiGenerationRecord[];
}

export async function getUserActivityFeed(userId: string, limit = 30) {
  const chatRows = await sql`
    SELECT
      cs.id,
      'chat' AS type,
      cs.mode,
      cs.title,
      cs.project_id,
      cs.updated_at AS timestamp,
      (SELECT COUNT(*)::int FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count
    FROM chat_sessions cs
    WHERE cs.user_id = ${userId}
    ORDER BY cs.updated_at DESC
    LIMIT ${limit}
  `;

  const voiceRows = await sql`
    SELECT
      vs.id,
      'voice' AS type,
      vs.project_id,
      vs.started_at AS timestamp,
      vs.duration_seconds,
      vs.transcript
    FROM voice_sessions vs
    WHERE vs.user_id = ${userId}
    ORDER BY vs.started_at DESC
    LIMIT ${limit}
  `;

  const buildRows = await sql`
    SELECT
      ag.id,
      'build' AS type,
      ag.project_id,
      ag.job_type,
      ag.model,
      ag.status,
      ag.created_at AS timestamp,
      ag.result
    FROM ai_generations ag
    WHERE ag.user_id = ${userId}
    ORDER BY ag.created_at DESC
    LIMIT ${limit}
  `;

  return {
    chatSessions: chatRows,
    voiceSessions: voiceRows,
    builds: buildRows,
  };
}
