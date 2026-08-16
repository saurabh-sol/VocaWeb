import type { ImportBundle, ImportSource } from '@theo/shared';
import {
  getDecryptedAccessToken,
  getDecryptedRefreshToken,
  saveIntegrationTokens,
} from './token-store.js';

function getCanvaRedirectUri(): string {
  const base =
    process.env.INTEGRATIONS_CALLBACK_BASE ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/integrations/canva/callback`;
}

export function getCanvaAuthUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.CANVA_CLIENT_ID!;
  const redirectUri = encodeURIComponent(
    process.env.CANVA_REDIRECT_URI ?? getCanvaRedirectUri(),
  );
  const scopes = encodeURIComponent(
    'design:meta:read design:content:read asset:read folder:read',
  );
  return `https://www.canva.com/api/oauth/authorize?code_challenge=${codeChallenge}&code_challenge_method=s256&scope=${scopes}&response_type=code&client_id=${clientId}&state=${encodeURIComponent(state)}&redirect_uri=${redirectUri}`;
}

export async function exchangeCanvaCode(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }> {
  const clientId = process.env.CANVA_CLIENT_ID!;
  const clientSecret = process.env.CANVA_CLIENT_SECRET!;
  const redirectUri = process.env.CANVA_REDIRECT_URI ?? getCanvaRedirectUri();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    throw new Error(`Canva token exchange failed: ${await res.text()}`);
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

async function refreshCanvaToken(userId: string): Promise<string | null> {
  const refreshToken = await getDecryptedRefreshToken(userId, 'canva');
  if (!refreshToken) return null;

  const clientId = process.env.CANVA_CLIENT_ID!;
  const clientSecret = process.env.CANVA_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  await saveIntegrationTokens({
    userId,
    provider: 'canva',
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in,
    scopes: data.scope?.split(' '),
  });

  return data.access_token;
}

async function canvaFetch(userId: string, path: string, init?: RequestInit) {
  let token = await getDecryptedAccessToken(userId, 'canva');
  if (!token) throw new Error('Canva not connected');

  let res = await fetch(`https://api.canva.com/rest/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    token = await refreshCanvaToken(userId);
    if (!token) throw new Error('Canva token expired — reconnect');
    res = await fetch(`https://api.canva.com/rest/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  if (!res.ok) {
    throw new Error(`Canva API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listCanvaDesigns(
  userId: string,
): Promise<Array<{ id: string; title: string; thumbnailUrl?: string }>> {
  const data = (await canvaFetch(userId, '/designs?limit=50')) as {
    items?: Array<{ id: string; title?: string; thumbnail?: { url?: string } }>;
  };

  return (data.items ?? []).map((d) => ({
    id: d.id,
    title: d.title ?? 'Untitled design',
    thumbnailUrl: d.thumbnail?.url,
  }));
}

export async function exportCanvaDesign(
  userId: string,
  designId: string,
  format: 'png' | 'html_standalone' | 'html_bundle' | 'pdf' = 'png',
): Promise<ArrayBuffer> {
  const job = (await canvaFetch(userId, '/exports', {
    method: 'POST',
    body: JSON.stringify({
      design_id: designId,
      format: { type: format },
    }),
  })) as { job?: { id: string } };

  const jobId = job.job?.id;
  if (!jobId) throw new Error('Canva export job failed to start');

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = (await canvaFetch(userId, `/exports/${jobId}`)) as {
      job?: {
        status?: string;
        urls?: string[];
        error?: { message?: string; code?: string };
      };
    };

    if (status.job?.status === 'success' && status.job.urls?.[0]) {
      const download = await fetch(status.job.urls[0]);
      if (!download.ok) throw new Error('Failed to download Canva export');
      return download.arrayBuffer();
    }
    if (status.job?.status === 'failed') {
      throw new Error(status.job.error?.message ?? 'Canva export failed');
    }
  }

  throw new Error('Canva export timed out');
}

export async function importFromCanva(
  userId: string,
  source: ImportSource,
  projectId?: string,
): Promise<Partial<ImportBundle>> {
  const format = source.format ?? 'png';
  const buffer = await exportCanvaDesign(userId, source.externalId, format);
  const ext = format === 'png' ? 'png' : format === 'pdf' ? 'pdf' : 'html';
  const safeName = (source.title ?? 'canva-design').replace(/[^a-z0-9-]/gi, '-').slice(0, 40);
  const projectPath = `public/import/canva-${safeName}.${ext}`;

  return {
    sources: [
      {
        provider: 'canva',
        externalId: source.externalId,
        title: source.title,
        url: source.url,
      },
    ],
    assets: [
      {
        path: projectPath,
        mime: format === 'png' ? 'image/png' : 'text/html',
        projectPath,
        url: undefined,
      },
    ],
    _binaryAsset: { projectPath, buffer: Buffer.from(buffer) },
    designTokens: format === 'png' ? { colors: ['#021A23', '#0ea5e9'] } : undefined,
  } as Partial<ImportBundle> & { _binaryAsset?: { projectPath: string; buffer: Buffer } };
}

export async function saveCanvaIntegration(
  userId: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  const tokens = await exchangeCanvaCode(code, codeVerifier);
  await saveIntegrationTokens({
    userId,
    provider: 'canva',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    scopes: tokens.scope?.split(' '),
  });
}
