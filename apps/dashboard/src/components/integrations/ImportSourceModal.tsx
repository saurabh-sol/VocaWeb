'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Link2, Check, Layers, Search, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import type { ImportSource, ImportBundle, IntegrationProvider } from '@/lib/shared-types';
import {
  connectIntegration,
  disconnectIntegration,
  fetchIntegrations,
  listIntegrationResources,
  runImport,
  runImportAndBuild,
  type ImportResource,
  type IntegrationStatus,
} from '@/lib/integrations';

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  notion: 'Notion',
  canva: 'Canva',
  figma: 'Figma',
};

const PROVIDER_DESC: Record<IntegrationProvider, string> = {
  notion: 'Import page copy & structure',
  canva: 'Export designs as assets',
  figma: 'Match layout & design tokens',
};

interface SelectedSource extends ImportSource {
  key: string;
}

export function ImportSourceModal({
  open,
  onClose,
  onImported,
  projectId,
  buildImmediately = false,
  defaultUseMcp = false,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: (result: { plan: string; bundle: ImportBundle; buildResult?: { projectId: string; files: Record<string, string> } }) => void;
  projectId?: string;
  buildImmediately?: boolean;
  defaultUseMcp?: boolean;
}) {
  const { getAccessToken, authenticated: isSignedIn } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [integrationsLoaded, setIntegrationsLoaded] = useState(false);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider>('notion');
  const [resources, setResources] = useState<ImportResource[]>([]);
  const [selected, setSelected] = useState<SelectedSource[]>([]);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [notionUrl, setNotionUrl] = useState('');
  const [notionSearch, setNotionSearch] = useState('');
  const [debouncedNotionSearch, setDebouncedNotionSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [useMcp, setUseMcp] = useState(defaultUseMcp);

  const loadIntegrations = useCallback(async () => {
    if (!isSignedIn) return;
    setIntegrationsLoaded(false);
    try {
      const list = await fetchIntegrations(getToken);
      setIntegrations(list);
      setError(null);
    } catch (e) {
      setIntegrations([]);
      setError(e instanceof Error ? e.message : 'Could not load integration status.');
    } finally {
      setIntegrationsLoaded(true);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (open) void loadIntegrations();
  }, [open, loadIntegrations]);

  useEffect(() => {
    if (open) setUseMcp(defaultUseMcp);
  }, [open, defaultUseMcp]);

  useEffect(() => {
    if (activeProvider !== 'notion') return;
    const timer = setTimeout(() => setDebouncedNotionSearch(notionSearch), 300);
    return () => clearTimeout(timer);
  }, [notionSearch, activeProvider]);

  const anyMcpReady = integrations.some(
    (i) => i.connected && (i.mcpConnected || i.provider !== 'canva'),
  );

  const activeIntegration = integrations.find((i) => i.provider === activeProvider);

  const loadResources = useCallback(async () => {
    if (!isSignedIn || !activeIntegration?.connected) return;
    setResourceLoading(true);
    setError(null);
    setHint(null);
    try {
      const data = await listIntegrationResources(
        activeProvider,
        getToken,
        activeProvider === 'figma' && figmaUrl
          ? { url: figmaUrl }
          : activeProvider === 'notion' && notionUrl
            ? { url: notionUrl }
            : activeProvider === 'notion' && debouncedNotionSearch
              ? { query: debouncedNotionSearch }
              : undefined,
      );
      setResources(data.resources);
      setHint(data.hint ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setResources([]);
    } finally {
      setResourceLoading(false);
    }
  }, [
    activeProvider,
    activeIntegration?.connected,
    debouncedNotionSearch,
    figmaUrl,
    getToken,
    isSignedIn,
    notionUrl,
  ]);

  useEffect(() => {
    if (open && activeIntegration?.connected && activeProvider === 'notion' && !notionUrl) {
      void loadResources();
    }
  }, [open, activeProvider, activeIntegration?.connected, loadResources, notionUrl, debouncedNotionSearch]);

  useEffect(() => {
    if (open && activeIntegration?.connected && activeProvider === 'canva') {
      void loadResources();
    }
  }, [open, activeProvider, activeIntegration?.connected, loadResources]);

  const handleConnect = async (provider: IntegrationProvider) => {
    const url = await connectIntegration(
      provider,
      getToken,
      `${window.location.origin}/settings`,
    );
    if (url) window.location.href = url;
  };

  const toggleResource = (resource: ImportResource) => {
    const key = `${activeProvider}:${resource.id}`;
    const exists = selected.find((s) => s.key === key);
    if (exists) {
      setSelected(selected.filter((s) => s.key !== key));
      return;
    }
    setSelected([
      ...selected,
      {
        key,
        provider: activeProvider,
        externalId: resource.id,
        title: resource.title,
        url: resource.url,
        format: activeProvider === 'canva' ? 'png' : undefined,
      },
    ]);
  };

  const handleImport = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const sources: ImportSource[] = selected.map((item) => {
        const { key: _, ...rest } = item;
        return rest;
      });
      if (buildImmediately) {
        const result = await runImportAndBuild(sources, getToken, {
          projectId,
          description: 'Build a website from my imported design sources.',
          useMcp,
        });
        onImported?.({
          plan: result.plan,
          bundle: result.bundle,
          buildResult: {
            projectId: result.buildResult.projectId,
            files: result.buildResult.files,
          },
        });
      } else {
        const result = await runImport(sources, getToken, projectId, { useMcp });
        onImported?.({ plan: result.plan, bundle: result.bundle });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-label="Close"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-[var(--border)]/40 bg-[var(--card)] shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]/30">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[var(--primary)]" />
              <h2 className="text-lg font-semibold">Import from sources</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--muted)]/40">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!isSignedIn ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              Sign in to connect Notion, Canva, or Figma.
            </div>
          ) : (
            <>
              <div className="flex gap-2 px-5 pt-4 border-b border-[var(--border)]/20 pb-3">
                {(['notion', 'canva', 'figma'] as IntegrationProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActiveProvider(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      activeProvider === p
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--muted)]/40 text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {PROVIDER_LABELS[p]}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">{PROVIDER_DESC[activeProvider]}</p>

                {!integrationsLoaded ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                  </div>
                ) : !activeIntegration?.configured ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                    <p className="text-sm text-amber-200">
                      {PROVIDER_LABELS[activeProvider]} is not configured on the API server yet.
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Add {activeProvider.toUpperCase()}_CLIENT_ID and {activeProvider.toUpperCase()}_CLIENT_SECRET
                      to your API environment (see .env.example), restart the API, then return here to connect.
                    </p>
                    <Link
                      href="/docs/integrations"
                      className="inline-block text-xs text-[var(--primary)] hover:underline"
                    >
                      Integrations setup guide →
                    </Link>
                  </div>
                ) : !activeIntegration.connected ? (
                  <button
                    onClick={() => void handleConnect(activeProvider)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium"
                  >
                    <Link2 className="w-4 h-4" />
                    Connect {PROVIDER_LABELS[activeProvider]}
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                      <div className="flex items-center gap-3">
                        {activeProvider === 'notion' && (
                          <button
                            onClick={() => void handleConnect('notion')}
                            className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Update page access
                          </button>
                        )}
                        <button
                          onClick={() => void disconnectIntegration(activeProvider, getToken).then(loadIntegrations)}
                          className="text-xs text-[var(--muted-foreground)] hover:text-red-400"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {activeProvider === 'notion' && (
                      <div className="rounded-xl border border-[var(--border)]/30 bg-[var(--muted)]/10 p-3 space-y-3">
                        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                          Notion only shows pages you shared with Vocaweb. To import Team HQ, Projects, Docs, etc.,
                          add them in Notion → page ⋯ → <strong>Connections</strong> → your integration, or click{' '}
                          <strong>Update page access</strong> above.
                        </p>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            <input
                              value={notionSearch}
                              onChange={(e) => {
                                setNotionSearch(e.target.value);
                                setNotionUrl('');
                              }}
                              placeholder="Search shared pages..."
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={notionUrl}
                            onChange={(e) => {
                              setNotionUrl(e.target.value);
                              setNotionSearch('');
                            }}
                            placeholder="Or paste a Notion page URL..."
                            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 text-sm"
                          />
                          <button
                            onClick={() => void loadResources()}
                            className="px-3 py-2 rounded-lg bg-[var(--muted)]/50 text-sm whitespace-nowrap"
                          >
                            Load page
                          </button>
                        </div>
                      </div>
                    )}

                    {activeProvider === 'figma' && (
                      <div className="flex gap-2">
                        <input
                          value={figmaUrl}
                          onChange={(e) => setFigmaUrl(e.target.value)}
                          placeholder="Paste Figma file URL..."
                          className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 text-sm"
                        />
                        <button
                          onClick={() => void loadResources()}
                          className="px-3 py-2 rounded-lg bg-[var(--muted)]/50 text-sm"
                        >
                          Load
                        </button>
                      </div>
                    )}

                    {hint && <p className="text-xs text-[var(--muted-foreground)]">{hint}</p>}

                    {resourceLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {resources.map((r) => {
                          const key = `${activeProvider}:${r.id}`;
                          const isSelected = selected.some((s) => s.key === key);
                          return (
                            <button
                              key={r.id}
                              onClick={() => toggleResource(r)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                                isSelected
                                  ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                  : 'border-[var(--border)]/30 hover:bg-[var(--muted)]/20'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  isSelected ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-[var(--primary-foreground)]" />}
                              </div>
                              <span className="text-sm font-medium truncate">{r.title}</span>
                            </button>
                          );
                        })}
                        {resources.length === 0 && activeProvider !== 'figma' && (
                          <div className="text-sm text-[var(--muted-foreground)] py-4 text-center space-y-2">
                            <p>No shared pages found.</p>
                            {activeProvider === 'notion' && (
                              <p className="text-xs">
                                Open a page in Notion → ⋯ → Connections → add Vocaweb, then click Update page access.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {selected.length > 0 && (
                  <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-3">
                    <p className="text-xs font-medium text-[var(--primary)] mb-2">
                      Import stack ({selected.length} selected)
                    </p>
                    <ul className="text-xs text-[var(--muted-foreground)] space-y-1">
                      {selected.map((s) => (
                        <li key={s.key}>
                          {PROVIDER_LABELS[s.provider]}: {s.title ?? s.externalId}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                {anyMcpReady && (
                  <label className="flex items-center gap-2 rounded-lg border border-[var(--border)]/30 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMcp}
                      onChange={(e) => setUseMcp(e.target.checked)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-sm">Use MCP for richer context</span>
                  </label>
                )}
              </div>

              <div className="flex gap-2 justify-end px-5 py-4 border-t border-[var(--border)]/30">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleImport()}
                  disabled={loading || selected.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {buildImmediately ? 'Import & Build' : 'Import to plan'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
