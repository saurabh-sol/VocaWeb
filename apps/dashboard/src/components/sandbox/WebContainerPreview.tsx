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
  idle: { label: 'Waiting for files...', icon: Loader2 },
  booting: { label: 'Booting WebContainer...', icon: Loader2, animate: true },
  installing: {
    label: 'Installing dependencies...',
    icon: Loader2,
    animate: true,
  },
  starting: {
    label: 'Starting dev server...',
    icon: Loader2,
    animate: true,
  },
  ready: { label: 'Live Preview', icon: CheckCircle2 },
  error: { label: 'Error', icon: AlertCircle },
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)]/30 bg-[var(--card)]/5">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon
            className={`w-3.5 h-3.5 shrink-0 ${
              status === 'error'
                ? 'text-red-400'
                : status === 'ready'
                  ? 'text-green-400'
                  : 'text-[var(--primary)]'
            } ${config.animate ? 'animate-spin' : ''}`}
          />
          <span className="text-xs font-medium text-[var(--muted-foreground)] truncate">
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-end">
          {previewUrl && (
            <>
              <button
                onClick={handleRefreshPreview}
                className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Refresh preview"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => window.open(previewUrl, '_blank')}
                className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              {onFixWithAgent && (
                <button
                  onClick={() => void handleFixWithAgent()}
                  disabled={fixing}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
                >
                  <Wrench className="w-3 h-3 shrink-0" />
                  {fixing ? 'Fixing…' : 'Fix with Vocaweb'}
                </button>
              )}
              <button
                onClick={handleRestart}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </>
          )}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
            title={showLogs ? 'Hide terminal' : 'Show terminal'}
          >
            <Terminal className="w-3 h-3" />
            {showLogs ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {showIframe ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Live Preview"
            className={`w-full h-full border-0 bg-white ${inspectMode ? 'cursor-crosshair' : ''}`}
          />
        ) : status === 'error' ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
            <div className="flex gap-2">
              {onFixWithAgent && (
                <button
                  onClick={() => void handleFixWithAgent()}
                  disabled={fixing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium disabled:opacity-50"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {fixing ? 'Fixing…' : 'Fix with Vocaweb'}
                </button>
              )}
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-[var(--primary)]/30 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {config.label}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {status === 'booting' && 'Initializing browser runtime...'}
                {status === 'installing' && 'This may take a moment...'}
                {status === 'starting' && 'Almost there...'}
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
              className="absolute bottom-0 left-0 right-0 border-t border-[var(--border)]/30 bg-[#0a0a0a]/95 backdrop-blur-sm overflow-hidden"
            >
              <div className="h-full overflow-y-auto p-2 font-mono text-[10px] leading-relaxed text-green-400/80">
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
