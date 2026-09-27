import { redis, redisConfigured } from './redis.js';
import type { ChatMessageRecord, ChatSessionRecord } from '@theo/db';

const SESSIONS_TTL = 300; // 5 min
const MESSAGES_TTL = 600; // 10 min

let redisAvailable = redisConfigured;

redis.on('error', () => {
  redisAvailable = false;
});

function sessionsKey(userId: string) {
  return `conv:user:${userId}:sessions`;
}

function messagesKey(sessionId: string) {
  return `conv:session:${sessionId}:messages`;
}

async function safeGet(key: string): Promise<string | null> {
  if (!redisAvailable) return null;
  try {
    return await redis.get(key);
  } catch {
    redisAvailable = false;
    return null;
  }
}

async function safeSet(key: string, value: string, ttl: number): Promise<void> {
  if (!redisAvailable) return;
  try {
    await redis.setex(key, ttl, value);
  } catch {
    redisAvailable = false;
  }
}

async function safeDel(...keys: string[]): Promise<void> {
  if (!redisAvailable || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    redisAvailable = false;
  }
}

export async function getCachedUserSessions(
  userId: string,
): Promise<ChatSessionRecord[] | null> {
  const raw = await safeGet(sessionsKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatSessionRecord[];
  } catch {
    return null;
  }
}

export async function setCachedUserSessions(
  userId: string,
  sessions: ChatSessionRecord[],
): Promise<void> {
  await safeSet(sessionsKey(userId), JSON.stringify(sessions), SESSIONS_TTL);
}

export async function getCachedSessionMessages(
  sessionId: string,
): Promise<ChatMessageRecord[] | null> {
  const raw = await safeGet(messagesKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChatMessageRecord[];
  } catch {
    return null;
  }
}

export async function setCachedSessionMessages(
  sessionId: string,
  messages: ChatMessageRecord[],
): Promise<void> {
  await safeSet(messagesKey(sessionId), JSON.stringify(messages), MESSAGES_TTL);
}

export async function invalidateUserSessionCache(userId: string): Promise<void> {
  await safeDel(sessionsKey(userId));
}

export async function invalidateSessionMessagesCache(sessionId: string): Promise<void> {
  await safeDel(messagesKey(sessionId));
}

export async function invalidateSessionCache(
  userId: string,
  sessionId?: string,
): Promise<void> {
  const keys = [sessionsKey(userId)];
  if (sessionId) keys.push(messagesKey(sessionId));
  await safeDel(...keys);
}
