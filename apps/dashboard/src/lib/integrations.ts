'use client';

import { apiFetch } from './api';
import type { ImportBundle, ImportSource, IntegrationProvider } from './shared-types';

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

export interface IntegrationStatus {
  provider: IntegrationProvider;
  connected: boolean;
  configured: boolean;
  mcpConfigured?: boolean;
  mcpConnected?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ImportResource {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
}

export async function fetchIntegrations(getToken: GetTokenFn): Promise<IntegrationStatus[]> {
  const res = await apiFetch('/integrations', {}, getToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Failed to load integrations (${res.status})`);
  }
  const data = await res.json();
  return data.integrations ?? [];
}

export async function connectIntegration(
  provider: IntegrationProvider,
  getToken: GetTokenFn,
  redirectAfter?: string,
): Promise<string | null> {
  const qs = redirectAfter ? `?redirect=${encodeURIComponent(redirectAfter)}` : '';
  const res = await apiFetch(`/integrations/${provider}/connect${qs}`, {}, getToken);
  if (!res.ok) return null;
  const data = await res.json();
  return data.authUrl ?? null;
}

export async function disconnectIntegration(
  provider: IntegrationProvider,
  getToken: GetTokenFn,
): Promise<boolean> {
  const res = await apiFetch(`/integrations/${provider}`, { method: 'DELETE' }, getToken);
  return res.ok;
}

export async function listIntegrationResources(
  provider: IntegrationProvider,
  getToken: GetTokenFn,
  options?: { url?: string; query?: string },
): Promise<{ resources: ImportResource[]; hint?: string }> {
  const params = new URLSearchParams();
  if (options?.url) params.set('url', options.url);
  if (options?.query) params.set('query', options.query);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/integrations/${provider}/resources${qs}`, {}, getToken);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to load resources');
  }
  return res.json();
}

export async function connectCanvaMcp(
  getToken: GetTokenFn,
  redirectAfter?: string,
): Promise<string | null> {
  const qs = redirectAfter ? `?redirect=${encodeURIComponent(redirectAfter)}` : '';
  const res = await apiFetch(`/integrations/canva/mcp/connect${qs}`, {}, getToken);
  if (!res.ok) return null;
  const data = await res.json();
  return data.authUrl ?? null;
}

export async function runImport(
  sources: ImportSource[],
  getToken: GetTokenFn,
  projectId?: string,
  options?: { useMcp?: boolean },
): Promise<{ bundle: ImportBundle; plan: string; mcpWarnings?: string[] }> {
  const res = await apiFetch(
    '/integrations/import',
    {
      method: 'POST',
      body: JSON.stringify({ sources, projectId, useMcp: options?.useMcp ?? false }),
    },
    getToken,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Import failed');
  }
  return res.json();
}

export async function runImportAndBuild(
  sources: ImportSource[],
  getToken: GetTokenFn,
  options?: { projectId?: string; description?: string; useMcp?: boolean },
): Promise<{
  bundle: ImportBundle;
  plan: string;
  mcpWarnings?: string[];
  buildResult: {
    projectId: string;
    filesGenerated: number;
    skillsUsed?: string[];
    files: Record<string, string>;
  };
}> {
  const res = await apiFetch(
    '/integrations/import/build',
    {
      method: 'POST',
      body: JSON.stringify({
        sources,
        projectId: options?.projectId,
        description: options?.description,
        useMcp: options?.useMcp ?? false,
      }),
    },
    getToken,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Import build failed');
  }
  return res.json();
}
