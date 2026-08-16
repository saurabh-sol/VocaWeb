import {
  getUserIntegration,
  upsertUserIntegration,
  type IntegrationProvider,
} from '@theo/db';
import { decryptToken, encryptToken } from '../integration-crypto.js';

export async function getDecryptedAccessToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<string | null> {
  const row = await getUserIntegration(userId, provider);
  if (!row) return null;
  try {
    return decryptToken(row.access_token);
  } catch {
    return null;
  }
}

export async function getDecryptedRefreshToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<string | null> {
  const row = await getUserIntegration(userId, provider);
  if (!row?.refresh_token) return null;
  try {
    return decryptToken(row.refresh_token);
  } catch {
    return null;
  }
}

export async function saveIntegrationTokens(input: {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const expiresAt =
    input.expiresIn != null ? new Date(Date.now() + input.expiresIn * 1000) : null;

  await upsertUserIntegration({
    userId: input.userId,
    provider: input.provider,
    accessToken: encryptToken(input.accessToken),
    refreshToken: input.refreshToken ? encryptToken(input.refreshToken) : null,
    expiresAt,
    scopes: input.scopes,
    metadata: input.metadata,
  });
}

export function integrationConfigured(provider: IntegrationProvider): boolean {
  switch (provider) {
    case 'notion':
      return !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
    case 'canva':
      return !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
    case 'figma':
      return !!(process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET);
    default:
      return false;
  }
}

export function getIntegrationRedirectUri(provider: IntegrationProvider): string {
  const base =
    process.env.INTEGRATIONS_CALLBACK_BASE ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/integrations/${provider}/callback`;
}

export function getWebRedirectBase(): string {
  return (
    process.env.WEB_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function isMcpConnectedForProvider(
  provider: IntegrationProvider,
  metadata: Record<string, unknown> | null | undefined,
  restConnected: boolean,
): boolean {
  if (!restConnected) return false;

  switch (provider) {
    case 'notion':
      return restConnected;
    case 'figma':
      return restConnected;
    case 'canva':
      return metadata?.mcpConnected === true && !!metadata?.mcpAccessToken;
    default:
      return false;
  }
}
