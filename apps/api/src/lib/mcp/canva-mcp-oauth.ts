import {
  getUserIntegration,
  mergeUserIntegrationMetadata,
} from '@theo/db';
import {
  createOAuthState,
  consumeOAuthState,
} from '../integrations/oauth-state.js';
import { getWebRedirectBase } from '../integrations/token-store.js';
import { decryptToken, encryptToken } from '../integration-crypto.js';

const CANVA_MCP_AUTHORIZE = 'https://mcp.canva.com/authorize';
const CANVA_MCP_TOKEN = 'https://mcp.canva.com/token';

function getCanvaMcpRedirectUri(): string {
  return (
    process.env.CANVA_MCP_REDIRECT_URI ??
    `${(process.env.INTEGRATIONS_CALLBACK_BASE ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/api/integrations/canva/mcp/callback`
  );
}

function getCanvaMcpClientId(): string {
  return (
    process.env.CANVA_MCP_CLIENT_ID_URL ??
    process.env.CANVA_MCP_CLIENT_ID ??
    ''
  );
}

export function isCanvaMcpOAuthConfigured(): boolean {
  return !!(
    process.env.CANVA_MCP_CLIENT_ID_URL ||
    (process.env.CANVA_MCP_CLIENT_ID && process.env.CANVA_MCP_CLIENT_SECRET)
  );
}

export function getCanvaMcpAuthUrl(state: string): string {
  const clientId = getCanvaMcpClientId();
  if (!clientId) throw new Error('Canva MCP OAuth not configured');

  const redirectUri = encodeURIComponent(getCanvaMcpRedirectUri());
  const scope = encodeURIComponent('design:meta:read design:content:read asset:read');
  return `${CANVA_MCP_AUTHORIZE}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;
}

export async function exchangeCanvaMcpCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}> {
  const clientId = getCanvaMcpClientId();
  const redirectUri = getCanvaMcpRedirectUri();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const clientSecret = process.env.CANVA_MCP_CLIENT_SECRET;
  if (clientSecret) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${auth}`;
  }

  const res = await fetch(CANVA_MCP_TOKEN, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`Canva MCP token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

export async function saveCanvaMcpIntegration(userId: string, code: string): Promise<void> {
  const row = await getUserIntegration(userId, 'canva');
  if (!row) {
    throw new Error('Connect Canva via REST first, then enable MCP');
  }

  const tokens = await exchangeCanvaMcpCode(code);
  const expiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
    : null;

  await mergeUserIntegrationMetadata(userId, 'canva', {
    mcpConnected: true,
    mcpAccessToken: encryptToken(tokens.accessToken),
    mcpRefreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
    mcpTokenExpiresAt: expiresAt,
    mcpScopes: tokens.scope?.split(' ') ?? [],
  });
}

export function createCanvaMcpOAuthState(userId: string, redirectAfter?: string): string {
  return createOAuthState(userId, 'canva', { redirectAfter });
}

export async function completeCanvaMcpOAuth(state: string, code: string): Promise<{
  userId: string;
  redirectAfter?: string;
}> {
  const pending = consumeOAuthState(state);
  if (!pending || pending.provider !== 'canva') {
    throw new Error('Invalid OAuth state');
  }
  await saveCanvaMcpIntegration(pending.userId, code);
  return { userId: pending.userId, redirectAfter: pending.redirectAfter };
}

export async function getDecryptedCanvaMcpToken(userId: string): Promise<string | null> {
  const row = await getUserIntegration(userId, 'canva');
  if (!row?.metadata?.mcpAccessToken) return null;
  try {
    return decryptToken(String(row.metadata.mcpAccessToken));
  } catch {
    return null;
  }
}

export function getCanvaMcpCimdDocument(): Record<string, unknown> {
  const webBase = getWebRedirectBase();
  return {
    client_id: process.env.CANVA_MCP_CLIENT_ID_URL ?? `${webBase}/.well-known/canva-mcp-client.json`,
    client_name: 'Vocaweb',
    client_uri: webBase,
    redirect_uris: [getCanvaMcpRedirectUri()],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: process.env.CANVA_MCP_CLIENT_SECRET
      ? 'client_secret_basic'
      : 'none',
  };
}

export function isCanvaMcpConnected(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.mcpConnected === true && !!metadata?.mcpAccessToken;
}
