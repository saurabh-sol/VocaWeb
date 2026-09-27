'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Terminal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import { useWebContainer, type WCStatus } from '@/hooks/useWebContainer';
import type { SelectedElementInfo } from '@/lib/vocaweb-inspect-bridge';
import { withInspectBridge } from '@/lib/vocaweb-inspect-bridge';
import { isStaticHtmlProject, buildStaticPreviewHtml } from '@/lib/scaffold-template';
import { Button } from '@/components/ui/button';

interface WebContainerPreviewProps {
  files: Record<string, string>;
  fileVersion?: number;
  projectId?: string | null;
  onFixWithAgent?: (error: string) => Promise<void>;
  inspectMode?: boolean;
  onElementSelect?: (element: SelectedElementInfo) => void;
}

const STATUS_CONFIG: Record<
  WCStatus,
  { label: string; icon: typeof Loader2; animate?: boolean }
> = {
  idle: { label: 'Waiting for files', icon: Loader2 },
  booting: { label: 'Starting the sandbox', icon: Loader2, animate: true },
  installing: {
    label: 'Installing dependencies',
    icon: Loader2,
    animate: true,
  },
  starting: {
    label: 'Starting the dev server',
    icon: Loader2,
    animate: true,
  },
  ready: { label: 'Live preview', icon: CheckCircle2 },
  error: { label: 'Preview error', icon: AlertCircle },
};

export function WebContainerPreview({
  files,
  fileVersion = 0,
  onFixWithAgent,
  inspectMode = false,
  onElementSelect,
}: WebContainerPreviewProps) {
  const isStatic = useMemo(() => isStaticHtmlProject(files), [files]);

  const staticBlobUrl = useMemo(() => {
    if (!isStatic || Object.keys(files).length === 0) return null;
    const html = buildStaticPreviewHtml(files);
    return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  }, [isStatic, files, fileVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (staticBlobUrl) URL.revokeObjectURL(staticBlobUrl);
    };
  }, [staticBlobUrl]);

  const { status: wcStatus, previewUrl: wcPreviewUrl, logs, error, mountAndRun, applyFiles, resetPreview } =
    useWebContainer();

  const status: WCStatus =
    isStatic && files['index.html'] ? 'ready' : isStatic ? 'idle' : wcStatus;
  const previewUrl = isStatic ? staticBlobUrl : wcPreviewUrl;

  const [showLogs, setShowLogs] = useState(false);
  const [fixing, setFixing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastVersionRef = useRef(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoFixAttemptedRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'vocaweb:set-inspect', enabled: inspectMode },
      '*',
    );
  }, [inspectMode, previewUrl]);

  useEffect(() => {
    function handleMessage(ev: MessageEvent) {
      if (ev.data?.type !== 'vocaweb:element-selected') return;
      onElementSelect?.(ev.data.payload as SelectedElementInfo);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  useEffect(() => {
    if (logEndRef.current && showLogs) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  useEffect(() => {
    if (isStatic) return;

    const fileCount = Object.keys(files).length;
    if (fileCount === 0) return;

    if (lastVersionRef.current === -1) {
      lastVersionRef.current = fileVersion;
      void mountAndRun(withInspectBridge(files));
      return;
    }

    if (fileVersion !== lastVersionRef.current) {
      lastVersionRef.current = fileVersion;
      void applyFiles(withInspectBridge(files));
    }
  }, [isStatic, files, fileVersion, mountAndRun, applyFiles]);

  useEffect(() => {
    if (
      status === 'error' &&
      error &&
      onFixWithAgent &&
      !autoFixAttemptedRef.current &&
      !fixing
    ) {
      autoFixAttemptedRef.current = true;
      void onFixWithAgent(error);
    }
  }, [status, error, onFixWithAgent, fixing]);

  const handleRestart = useCallback(() => {
    resetPreview();
    lastVersionRef.current = -1;
    autoFixAttemptedRef.current = false;
    setTimeout(() => {
      void mountAndRun(withInspectBridge(files), true);
    }, 0);
  }, [files, mountAndRun, resetPreview]);

  const handleFixWithAgent = useCallback(async () => {
    if (!error || !onFixWithAgent) return;
    setFixing(true);
    try {
      await onFixWithAgent(error);
    } finally {
      setFixing(false);
    }
  }, [error, onFixWithAgent]);

  const handleRefreshPreview = () => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  };

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const showIframe = previewUrl && (status === 'ready' || status === 'installing' || status === 'starting');

  const iconButton =
    'rounded-md p-1.5 text-dim transition-colors hover:bg-wash hover:text-ink';
  const textButton =
    'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-dim transition-colors hover:bg-wash hover:text-ink disabled:opacity-50';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-dashed border-soft px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2" role="status">
          <StatusIcon
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 ${
              status === 'error' ? 'text-bad' : status === 'ready' ? 'text-ok' : 'text-dim'
            } ${config.animate ? 'animate-spin' : ''}`}
          />
          <span className="truncate font-mono text-[11.5px] text-dim">{config.label}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-0.5">
          {previewUrl && (
            <>
              <button
                type="button"
                onClick={handleRefreshPreview}
                className={iconButton}
                aria-label="Refresh the preview"
                title="Refresh the preview"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => window.open(previewUrl, '_blank')}
                className={iconButton}
                aria-label="Open the preview in a new tab"
                title="Open in a new tab"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              {onFixWithAgent && (
                <button
                  type="button"
                  onClick={() => void handleFixWithAgent()}
                  disabled={fixing}
                  className={`${textButton} !text-brand`}
                >
                  <Wrench className="h-3 w-3 shrink-0" aria-hidden />
                  {fixing ? 'Fixing' : 'Fix with VocaWeb'}
                </button>
              )}
              <button type="button" onClick={handleRestart} className={textButton}>
                <RefreshCw className="h-3 w-3" aria-hidden />
                Retry
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            aria-expanded={showLogs}
            className={textButton}
            title={showLogs ? 'Hide the terminal' : 'Show the terminal'}
          >
            <Terminal className="h-3 w-3" aria-hidden />
            {showLogs ? (
              <ChevronDown className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronUp className="h-3 w-3" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {showIframe ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Live preview"
            className={`h-full w-full border-0 bg-white ${inspectMode ? 'cursor-crosshair' : ''}`}
          />
        ) : status === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6" role="alert">
            <AlertCircle className="h-8 w-8 text-bad" aria-hidden />
            <p className="max-w-md text-center text-sm text-bad">{error}</p>
            <div className="flex gap-2">
              {onFixWithAgent && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleFixWithAgent()}
                  loading={fixing}
                >
                  {!fixing && <Wrench className="h-3.5 w-3.5" aria-hidden />}
                  {fixing ? 'Fixing' : 'Fix with VocaWeb'}
                </Button>
              )}
              <Button size="sm" onClick={handleRestart}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4" role="status">
            <span className="grid h-12 w-12 place-items-center rounded-[10px] border-[1.5px] border-rule bg-paper shadow-hard-sm">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </span>
            <div className="text-center">
              <p className="font-display text-[15px] font-semibold">{config.label}</p>
              <p className="mt-1 font-mono text-[11.5px] text-dim">
                {status === 'booting' && 'Preparing the browser runtime'}
                {status === 'installing' && 'This can take a moment'}
                {status === 'starting' && 'Almost there'}
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 160 }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 left-0 right-0 overflow-hidden border-t-[1.5px] border-rule bg-[var(--vw-code-bg)]"
            >
              <div className="h-full overflow-y-auto p-2.5 font-mono text-[10.5px] leading-relaxed text-[var(--vw-code-ink)]">
                {logs.length === 0 && <p className="opacity-50">No output yet.</p>}
                {logs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
