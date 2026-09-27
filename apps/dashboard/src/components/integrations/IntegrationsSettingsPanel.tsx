'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '@/lib/auth';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { siFigma, siNotion } from 'simple-icons';
import { Link2, Check, Download } from 'lucide-react';
import { BrandIcon } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { Tag } from '@/components/ui/tag';
import { APP_SETTINGS } from '@/lib/routes';
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
  canva: 'Export designs as image assets for your site.',
  figma: 'Extract layout, colours and fonts from Figma files.',
};

function ProviderLogo({ provider }: { provider: IntegrationProvider }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border-[1.5px] border-rule bg-white text-[#101010]">
      {provider === 'notion' && <BrandIcon icon={siNotion} size={20} />}
      {provider === 'figma' && <BrandIcon icon={siFigma} size={19} colored />}
      {provider === 'canva' && (
        <Image
          src="/integrations/canva-logo.png"
          alt=""
          width={40}
          height={40}
          className="h-full w-full scale-125 object-contain"
        />
      )}
    </span>
  );
}

const MCP_STORAGE_KEY = 'vocaweb:mcp-enrichment';

export function IntegrationsSettingsPanel() {
  const { getToken, isSignedIn } = useAuthSession();
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

  const returnTo = () => `${window.location.origin}${APP_SETTINGS}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="vw-card space-y-6 p-6"
    >
      <CardHeader
        title="Integrations"
        description="Connect Notion, Canva and Figma to bring content and design into your builds."
        className="flex-wrap"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setImportOpen(true)}
            disabled={!isSignedIn}
            className="shrink-0"
          >
            <Download className="h-4 w-4" aria-hidden />
            Import to project
          </Button>
        }
      />

      <label className="vw-card-soft flex cursor-pointer items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={mcpEnrichment}
          onChange={(e) => toggleMcpEnrichment(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--vw-brand)]"
        />
        <span>
          <span className="block text-sm font-semibold">Use MCP enrichment by default</span>
          <span className="mt-0.5 block text-[12.5px] text-dim">
            Model Context Protocol gives the build richer context from your connected sources.
          </span>
        </span>
      </label>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true">
          {PROVIDERS.map((provider) => (
            <Skeleton key={provider} className="h-[150px] w-full rounded-lg" />
          ))}
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
              <div key={provider} className="vw-card-soft flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <ProviderLogo provider={provider} />
                  <p className="font-display text-[16px] font-semibold">{LABELS[provider]}</p>
                </div>
                <p className="text-[12.5px] text-dim">{DESCRIPTIONS[provider]}</p>

                <div className="mt-auto">
                  {!configured ? (
                    <p className="text-[12px] text-warn">
                      Not set up on the server. Add {provider.toUpperCase()}_CLIENT_ID and
                      _CLIENT_SECRET to the API environment.
                    </p>
                  ) : connected ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Tag tone="ok">
                          <Check className="h-3 w-3" aria-hidden /> Connected
                        </Tag>
                        {mcpConfigured && (
                          <Tag tone={mcpConnected ? 'ok' : 'neutral'}>
                            MCP{' '}
                            {mcpConnected ? 'on' : provider === 'canva' ? 'off' : 'ready'}
                          </Tag>
                        )}
                      </div>
                      {provider === 'canva' && mcpConfigured && !mcpConnected && (
                        <button
                          type="button"
                          onClick={async () => {
                            const url = await connectCanvaMcp(getToken, returnTo());
                            if (url) window.location.href = url;
                          }}
                          className="block text-xs font-semibold text-brand hover:underline"
                        >
                          Connect Canva MCP
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void disconnectIntegration(provider, getToken).then(load)}
                        className="block text-xs font-semibold text-dim hover:text-bad"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!isSignedIn}
                      onClick={async () => {
                        const url = await connectIntegration(provider, getToken, returnTo());
                        if (url) window.location.href = url;
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      Connect
                    </Button>
                  )}
                </div>
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
