import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAuthUser, requireAuthUser } from '../lib/privy-auth.js';
import {
  startVoiceSessionDb,
  persistVoiceTranscriptDb,
  finalizeVoiceSessionDb,
} from '../lib/conversation-store.js';
import { getUserVoiceSessions, getVoiceSession } from '@theo/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS_DIR = join(__dirname, '..', '..', '..', '..', 'data', 'transcripts');

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function voiceRoutes(app: FastifyInstance) {

  /** Start a DB-backed voice session (authenticated) */
  app.post('/sessions/db', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { projectId } = request.body as { projectId?: string };
    const sessionId = await startVoiceSessionDb(user.userId, projectId);
    if (!sessionId) return reply.status(500).send({ error: 'Could not create voice session' });
    return { sessionId };
  });

  /** Sync voice transcript to DB */
  app.post('/sessions/db/sync', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId, messages, projectId } = request.body as {
      sessionId: string;
      messages: Array<{ role: string; text: string; timestamp?: string }>;
      projectId?: string;
    };

    if (!sessionId || !messages?.length) {
      return reply.status(400).send({ error: 'sessionId and messages are required' });
    }

    // Allow empty-array sync for flush-only; skip DB write if no content
    if (messages.length === 0) {
      return { ok: true };
    }

    await persistVoiceTranscriptDb(user.userId, sessionId, messages, projectId);
    return { ok: true };
  });

  /** End a DB voice session */
  app.post('/sessions/db/end', async (request, reply) => {
    let user;
    try {
      user = await requireAuthUser(request);
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId, durationSeconds } = request.body as {
      sessionId: string;
      durationSeconds?: number;
    };

    if (!sessionId) return reply.status(400).send({ error: 'sessionId is required' });
    await finalizeVoiceSessionDb(user.userId, sessionId, durationSeconds ?? 0);
    return { ok: true };
  });

  /** List DB voice sessions for authenticated user */
  app.get('/sessions/db', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    const sessions = await getUserVoiceSessions(user.userId);
    return { sessions };
  });

  app.get('/sessions/db/:id', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const session = await getVoiceSession(id, user.userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return { session };
  });

  // Save a voice transcript (authenticated, DB-backed + filesystem)
  app.post('/transcripts', async (request, reply) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const body = request.body as {
      sessionId?: string;
      messages: { role: string; text: string; timestamp?: string }[];
      projectId?: string;
    };

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return reply.status(400).send({ error: 'messages array is required' });
    }

    let sessionId = body.sessionId;

    if (!sessionId) {
      sessionId = (await startVoiceSessionDb(authUser.userId, body.projectId)) ?? undefined;
    }
    if (sessionId) {
      await persistVoiceTranscriptDb(authUser.userId, sessionId, body.messages, body.projectId);
      await finalizeVoiceSessionDb(authUser.userId, sessionId);
    }

    sessionId = sessionId || `session_${Date.now()}`;
    const transcript = {
      sessionId,
      userId: authUser.userId,
      createdAt: new Date().toISOString(),
      messages: body.messages.map((m) => ({
        role: m.role,
        text: m.text,
        timestamp: m.timestamp || new Date().toISOString(),
      })),
    };

    await ensureDir(TRANSCRIPTS_DIR);
    const filePath = join(TRANSCRIPTS_DIR, `${sessionId}.json`);
    await writeFile(filePath, JSON.stringify(transcript, null, 2), 'utf-8');

    app.log.info(`Saved transcript: ${sessionId}`);
    return reply.send({ ok: true, sessionId });
  });

  // Get all saved transcripts (authenticated, user-scoped)
  app.get('/transcripts', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Authentication required' });

    try {
      await ensureDir(TRANSCRIPTS_DIR);
      const { readdir } = await import('node:fs/promises');
      const files = (await readdir(TRANSCRIPTS_DIR)).filter((f) => f.endsWith('.json')).sort().reverse();

      const transcripts = [];
      for (const file of files) {
        const raw = await readFile(join(TRANSCRIPTS_DIR, file), 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.userId === user.userId) {
          transcripts.push(parsed);
        }
      }

      return reply.send({ transcripts });
    } catch {
      return reply.send({ transcripts: [] });
    }
  });

  // Get a single transcript by sessionId (authenticated, user-scoped)
  app.get('/transcripts/:sessionId', async (request, reply) => {
    const user = await getAuthUser(request);
    if (!user) return reply.status(401).send({ error: 'Authentication required' });

    const { sessionId } = request.params as { sessionId: string };
    try {
      const filePath = join(TRANSCRIPTS_DIR, `${sessionId}.json`);
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.userId && parsed.userId !== user.userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      return reply.send(parsed);
    } catch {
      return reply.status(404).send({ error: 'Transcript not found' });
    }
  });

  app.get('/realtime', { websocket: true }, (socket, req) => {
    const apiKey = process.env.xai_api_key || process.env.XAI_API_KEY;
    
    if (!apiKey) {
      socket.send(JSON.stringify({ type: 'error', message: 'Voice service not configured — set XAI_API_KEY' }));
      socket.close();
      return;
    }

    const agentId = process.env.XAI_AGENT_ID || 'agent_2n5CWzRcXcDjj2Zc';
    const xaiWs = new WebSocket(`wss://api.x.ai/v1/realtime?agent_id=${agentId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    xaiWs.on('open', () => {
      app.log.info('Connected to xAI Voice Agent API');
      socket.send(JSON.stringify({ type: 'connected' }));
    });

    xaiWs.on('message', (data) => {
      if (socket.readyState === 1) {
        socket.send(data.toString());
      }
    });

    xaiWs.on('close', () => {
      app.log.info('xAI Voice Agent API disconnected');
      if (socket.readyState === 1) socket.close();
    });

    xaiWs.on('error', (err) => {
      app.log.error(err, 'xAI WebSocket error');
      try {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'error', message: `xAI connection failed: ${err.message}` }));
          socket.close();
        }
      } catch { /* socket already gone */ }
    });

    socket.on('message', (message: Buffer | string) => {
      if (xaiWs.readyState === WebSocket.OPEN) {
        xaiWs.send(message.toString());
      }
    });

    socket.on('close', () => {
      xaiWs.close();
    });
  });

  app.post('/token', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return reply.status(503).send({ error: 'Voice service not configured — set XAI_API_KEY' });
    }

    try {
      const response = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          expires_after: { seconds: 300 },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        app.log.error(`xAI token error: ${response.status} ${text}`);
        return reply.status(502).send({ error: 'Failed to mint voice token' });
      }

      const data = (await response.json()) as { value: string; expires_at: string };
      return reply.send({ token: data.value, expiresAt: data.expires_at });
    } catch (err) {
      app.log.error(err, 'Failed to fetch xAI ephemeral token');
      return reply.status(500).send({ error: 'Internal error minting voice token' });
    }
  });

  app.get('/sessions', async () => {
    return { sessions: [] };
  });

  app.get('/sessions/:id', async (request, reply) => {
    return reply.status(501).send({ error: 'Not implemented — Phase 2 voice session retrieval pending' });
  });
}
