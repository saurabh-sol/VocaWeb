'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Link2, Check, Loader2, Layers, ExternalLink, BookOpen } from 'lucide-react';
import type { IntegrationProvider } from '@/lib/shared-types';
import {
  connectIntegration,
  connectCanvaMcp,
  disconnectIntegration,
  fetchIntegrations,
  type IntegrationStatus,
} from '@/lib/integrations';
import { ImportSourceModal } from './ImportSourceModal';

const PROVIDERS: IntegrationProvider[] = ['notion', 'canva', 'figma'];

const LABELS: Record<IntegrationProvider, string> = {
  notion: 'Notion',
  canva: 'Canva',
  figma: 'Figma',
};

const DESCRIPTIONS: Record<IntegrationProvider, string> = {
  notion: 'Import page content and structure as your site copy.',
  canva: 'Export designs as PNG/HTML assets for your site.',
  figma: 'Extract layout, colors, and fonts from Figma files.',
};

const MCP_STORAGE_KEY = 'vocaweb:mcp-enrichment';

export function IntegrationsSettingsPanel() {
  const { getAccessToken, authenticated: isSignedIn } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [mcpEnrichment, setMcpEnrichment] = useState(false);

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setIntegrations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchIntegrations(getToken);
      setIntegrations(list);
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void load();
    try {
      setMcpEnrichment(localStorage.getItem(MCP_STORAGE_KEY) === 'true');
    } catch {
      /* ignore */
    }
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('integration') === 'connected' ||
      params.get('integration') === 'mcp_connected'
    ) {
      void load();
    }
  }, [load]);

  const toggleMcpEnrichment = (enabled: boolean) => {
    setMcpEnrichment(enabled);
    try {
      localStorage.setItem(MCP_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  };

  const getStatus = (p: IntegrationProvider) =>
    integrations.find((i) => i.provider === p);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-6 shadow-sm space-y-6"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--primary)]" />
            Integrations
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Connect Notion, Canva, and Figma to import content and design into your builds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/docs/mcp/ide-setup"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)]/30"
          >
            <BookOpen className="w-4 h-4" />
            IDE MCP setup
          </a>
          <button
            onClick={() => setImportOpen(true)}
            disabled={!isSignedIn}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            Import to project
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-[var(--border)]/30 p-4 bg-[var(--background)]/30 cursor-pointer">
        <input
          type="checkbox"
          checked={mcpEnrichment}
          onChange={(e) => toggleMcpEnrichment(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        <div>
          <p className="text-sm font-medium">
            Enable MCP enrichment by default
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Use Model Context Protocol for richer import context when building from connected sources.
          </p>
        </div>
      </label>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const status = getStatus(provider);
            const connected = status?.connected ?? false;
            const configured = status?.configured ?? false;
            const mcpConfigured = status?.mcpConfigured ?? false;
            const mcpConnected = status?.mcpConnected ?? false;

            return (
              <div
                key={provider}
                className="rounded-xl border border-[var(--border)]/30 p-4 space-y-3 bg-[var(--background)]/30"
              >
                <div>
                  <p className="font-medium">{LABELS[provider]}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{DESCRIPTIONS[provider]}</p>
                </div>

                {!configured ? (
                  <p className="text-xs text-amber-400">
                    Not configured on API — add {provider.toUpperCase()}_CLIENT_ID and _CLIENT_SECRET (see .env.example)
                  </p>
                ) : connected ? (
                  <div className="space-y-2">
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> REST connected
                    </span>
                    {mcpConfigured && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          mcpConnected ? 'text-green-400' : 'text-[var(--muted-foreground)]'
                        }`}
                      >
                        MCP {mcpConnected ? 'connected' : provider === 'canva' ? 'not connected' : 'ready'}
                      </span>
                    )}
                    {provider === 'canva' && mcpConfigured && !mcpConnected && (
                      <button
                        onClick={async () => {
                          const url = await connectCanvaMcp(
                            getToken,
                            `${window.location.origin}/settings`,
                          );
                          if (url) window.location.href = url;
                        }}
                        className="text-xs text-[var(--primary)] hover:underline"
                      >
                        Connect Canva MCP
                      </button>
                    )}
                    <button
                      onClick={() => void disconnectIntegration(provider, getToken).then(load)}
                      className="text-xs text-[var(--muted-foreground)] hover:text-red-400 block"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const url = await connectIntegration(
                        provider,
                        getToken,
                        `${window.location.origin}/settings`,
                      );
                      if (url) window.location.href = url;
                    }}
                    disabled={!isSignedIn}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium hover:bg-[var(--muted)]/30 disabled:opacity-50"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ImportSourceModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultUseMcp={mcpEnrichment}
      />
    </motion.section>
  );
}
