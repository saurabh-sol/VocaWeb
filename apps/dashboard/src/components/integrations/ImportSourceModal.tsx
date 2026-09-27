'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Check, Layers, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Notice, Tag } from '@/components/ui/tag';
import { APP_SETTINGS } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useAuthSession } from '@/lib/auth';
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
  const { getToken, isSignedIn } = useAuthSession();
  
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
      `${window.location.origin}${APP_SETTINGS}`,
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-[var(--overlay)]"
            onClick={onClose}
            aria-label="Close"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[10px] border-[1.5px] border-rule bg-paper shadow-hard-lg"
          >
            <div className="flex items-center justify-between border-b-[1.5px] border-rule px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Layers className="h-5 w-5" aria-hidden />
                <h2 id="import-title" className="text-lg font-semibold">
                  Import from sources
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-2 text-dim transition-colors hover:bg-wash hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isSignedIn ? (
              <p className="p-8 text-center text-dim">
                Sign in to connect Notion, Canva or Figma.
              </p>
            ) : (
              <>
                <div
                  role="tablist"
                  aria-label="Source"
                  className="flex gap-1 border-b-[1.5px] border-dashed border-soft px-5 py-3"
                >
                  {(['notion', 'canva', 'figma'] as IntegrationProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={activeProvider === p}
                      data-active={activeProvider === p}
                      onClick={() => setActiveProvider(p)}
                      className="vw-navlink !h-8 !text-[13px]"
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  <p className="text-sm text-dim">{PROVIDER_DESC[activeProvider]}</p>

                  {!integrationsLoaded ? (
                    <div className="grid gap-2" aria-busy="true">
                      <Skeleton className="h-11 w-full" />
                      <Skeleton className="h-11 w-full" />
                      <Skeleton className="h-11 w-2/3" />
                    </div>
                  ) : !activeIntegration?.configured ? (
                    <Notice tone="warn" className="space-y-1.5">
                      <p className="font-semibold">
                        {PROVIDER_LABELS[activeProvider]} is not set up on the server yet.
                      </p>
                      <p className="text-[12.5px] text-dim">
                        Add {activeProvider.toUpperCase()}_CLIENT_ID and{' '}
                        {activeProvider.toUpperCase()}_CLIENT_SECRET to the API environment, restart
                        the API, then come back here to connect.
                      </p>
                    </Notice>
                  ) : !activeIntegration.connected ? (
                    <Button variant="primary" onClick={() => void handleConnect(activeProvider)}>
                      <Link2 className="h-4 w-4" aria-hidden />
                      Connect {PROVIDER_LABELS[activeProvider]}
                    </Button>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Tag tone="ok">
                          <Check className="h-3 w-3" aria-hidden /> Connected
                        </Tag>
                        <div className="flex items-center gap-4">
                          {activeProvider === 'notion' && (
                            <button
                              type="button"
                              onClick={() => void handleConnect('notion')}
                              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                            >
                              <RefreshCw className="h-3 w-3" aria-hidden />
                              Update page access
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              void disconnectIntegration(activeProvider, getToken).then(
                                loadIntegrations,
                              )
                            }
                            className="text-xs font-semibold text-dim hover:text-bad"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>

                      {activeProvider === 'notion' && (
                        <div className="vw-card-soft space-y-3 p-3">
                          <p className="text-[12.5px] leading-relaxed text-dim">
                            Notion only shows pages you shared with VocaWeb. To add more, open the
                            page in Notion, choose <strong>Connections</strong> and add your
                            integration, or use <strong>Update page access</strong> above.
                          </p>
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim"
                              aria-hidden
                            />
                            <input
                              value={notionSearch}
                              onChange={(e) => {
                                setNotionSearch(e.target.value);
                                setNotionUrl('');
                              }}
                              aria-label="Search shared Notion pages"
                              placeholder="Search shared pages"
                              className="vw-input pl-9"
                            />
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={notionUrl}
                              onChange={(e) => {
                                setNotionUrl(e.target.value);
                                setNotionSearch('');
                              }}
                              aria-label="Notion page URL"
                              placeholder="Or paste a Notion page URL"
                              className="vw-input flex-1"
                            />
                            <Button size="sm" onClick={() => void loadResources()}>
                              Load page
                            </Button>
                          </div>
                        </div>
                      )}

                      {activeProvider === 'figma' && (
                        <div className="flex gap-2">
                          <input
                            value={figmaUrl}
                            onChange={(e) => setFigmaUrl(e.target.value)}
                            aria-label="Figma file URL"
                            placeholder="Paste a Figma file URL"
                            className="vw-input flex-1"
                          />
                          <Button size="sm" onClick={() => void loadResources()}>
                            Load
                          </Button>
                        </div>
                      )}

                      {hint && <p className="text-xs text-dim">{hint}</p>}

                      {resourceLoading ? (
                        <div className="grid gap-2" aria-busy="true">
                          <Skeleton className="h-11 w-full" />
                          <Skeleton className="h-11 w-full" />
                          <Skeleton className="h-11 w-full" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {resources.map((r) => {
                            const key = `${activeProvider}:${r.id}`;
                            const isSelected = selected.some((s) => s.key === key);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => toggleResource(r)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-lg border-[1.5px] p-3 text-left transition-[border-color,box-shadow,background-color]',
                                  isSelected
                                    ? 'border-rule bg-wash shadow-hard-sm'
                                    : 'border-soft hover:border-rule',
                                )}
                              >
                                <span
                                  className={cn(
                                    'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-[1.5px]',
                                    isSelected ? 'border-ink bg-ink text-paper' : 'border-soft',
                                  )}
                                >
                                  {isSelected && (
                                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />
                                  )}
                                </span>
                                <span className="truncate text-sm font-medium">{r.title}</span>
                              </button>
                            );
                          })}
                          {resources.length === 0 && activeProvider !== 'figma' && (
                            <div className="space-y-2 py-4 text-center text-sm text-dim">
                              <p>No shared pages found.</p>
                              {activeProvider === 'notion' && (
                                <p className="text-xs">
                                  Share a page with VocaWeb in Notion, then use Update page access.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {selected.length > 0 && (
                    <div className="vw-card-soft border-dashed p-3">
                      <p className="vw-kicker mb-2 text-ink">{selected.length} selected</p>
                      <ul className="space-y-1 text-xs text-dim">
                        {selected.map((s) => (
                          <li key={s.key}>
                            {PROVIDER_LABELS[s.provider]}: {s.title ?? s.externalId}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {error && (
                    <Notice tone="bad" role="alert">
                      {error}
                    </Notice>
                  )}

                  {anyMcpReady && (
                    <label className="vw-card-soft flex cursor-pointer items-center gap-2.5 p-3">
                      <input
                        type="checkbox"
                        checked={useMcp}
                        onChange={(e) => setUseMcp(e.target.checked)}
                        className="h-4 w-4 accent-[var(--vw-brand)]"
                      />
                      <span className="text-sm">Use MCP for richer context</span>
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t-[1.5px] border-rule px-5 py-4">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => void handleImport()}
                    disabled={selected.length === 0}
                    loading={loading}
                  >
                    {buildImmediately ? 'Import and build' : 'Import to plan'}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
