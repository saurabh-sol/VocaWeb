import type { IntegrationProvider } from '@theo/shared';
import {
  closeMcpClient,
  createMcpClient,
  type McpAuthContext,
  type McpClientHandle,
} from './mcp-client.js';
import { getProviderMcpConfig } from './provider-config.js';

interface CachedSession {
  handle: McpClientHandle;
  expiresAt: number;
}

const sessions = new Map<string, CachedSession>();

function sessionKey(userId: string, provider: IntegrationProvider): string {
  return `${userId}:${provider}`;
}

function getSessionTtlMs(): number {
  const raw = process.env.MCP_SESSION_TTL_SECONDS;
  const seconds = raw ? Number.parseInt(raw, 10) : 900;
  return Number.isFinite(seconds) ? seconds * 1000 : 900_000;
}

export async function withMcpSession<T>(
  userId: string,
  provider: IntegrationProvider,
  auth: McpAuthContext,
  fn: (handle: McpClientHandle) => Promise<T>,
): Promise<T> {
  const key = sessionKey(userId, provider);
  const now = Date.now();
  const cached = sessions.get(key);

  if (cached && cached.expiresAt > now) {
    try {
      return await fn(cached.handle);
    } catch {
      await closeMcpClient(cached.handle).catch(() => {});
      sessions.delete(key);
    }
  } else if (cached) {
    await closeMcpClient(cached.handle).catch(() => {});
    sessions.delete(key);
  }

  const config = getProviderMcpConfig(provider);
  if (config.transport === 'bridge') {
    throw new Error(`Bridge provider ${provider} does not use MCP sessions`);
  }

  const handle = await createMcpClient(provider, auth);
  sessions.set(key, { handle, expiresAt: now + getSessionTtlMs() });

  try {
    return await fn(handle);
  } catch (err) {
    await closeMcpClient(handle).catch(() => {});
    sessions.delete(key);
    throw err;
  }
}

export async function invalidateMcpSession(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  const key = sessionKey(userId, provider);
  const cached = sessions.get(key);
  if (cached) {
    await closeMcpClient(cached.handle).catch(() => {});
    sessions.delete(key);
  }
}

export function clearAllMcpSessions(): void {
  for (const [key, cached] of sessions) {
    closeMcpClient(cached.handle).catch(() => {});
    sessions.delete(key);
  }
}
