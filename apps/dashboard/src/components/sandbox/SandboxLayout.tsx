'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import {
  Send,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Monitor,
  ArrowLeft,
  ExternalLink,
  X,
  CheckCircle2,
  Globe,
  Copy,
  Check,
  ChevronRight,
  Pencil,
  RotateCw,
  PanelRightClose,
  PanelRight,
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { PublishStatus } from '@/store';
import { FileExplorer } from './FileExplorer';
import { CodeViewer } from './CodeViewer';
import { WebContainerPreview } from './WebContainerPreview';
import { SandboxEditPanel, type SandboxChatMessage } from './SandboxEditPanel';
import type { SelectedElementInfo } from '@/lib/vocaweb-inspect-bridge';
import { apiFetch } from '@/lib/api';
import { normalizePublishUrl, resolvePublishDisplayUrl, isVercelDeploymentPreviewUrl } from '@/lib/utils';
import { getDeployBaseDomain } from '@/lib/deploy-domain';

export function SandboxLayout() {
  const { getAccessToken } = usePrivy();
  // Using an async wrapper for getAccessToken to mimic the previous getToken behavior
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  
  const isBuilding = useAppStore((s) => s.isBuilding);
  const sandboxViewMode = useAppStore((s) => s.sandboxViewMode);
  const sandboxSidebarOpen = useAppStore((s) => s.sandboxSidebarOpen);
  const setSandboxViewMode = useAppStore((s) => s.setSandboxViewMode);
  const setSandboxSidebarOpen = useAppStore((s) => s.setSandboxSidebarOpen);
  const currentProject = useAppStore((s) => s.currentProject);
  const projectFiles = useAppStore((s) => s.projectFiles);
  const activeFile = useAppStore((s) => s.activeFile);
  const setActiveFile = useAppStore((s) => s.setActiveFile);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const fileVersion = useAppStore((s) => s.fileVersion);
  const incrementFileVersion = useAppStore((s) => s.incrementFileVersion);
  const resetProject = useAppStore((s) => s.resetProject);

  const publishStatus = useAppStore((s) => s.publishStatus);
  const publishUrl = useAppStore((s) => s.publishUrl);
  const publishDomain = useAppStore((s) => s.publishDomain);
  const publishError = useAppStore((s) => s.publishError);
  const setPublishState = useAppStore((s) => s.setPublishState);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [sandboxMessages, setSandboxMessages] = useState<SandboxChatMessage[]>([]);
  const [editPanelOpen, setEditPanelOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [domainSaving, setDomainSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const publishPanelRef = useRef<HTMLDivElement>(null);

  const fileCount = Object.keys(projectFiles).length;
  const previewKey = `${currentProject ?? 'new'}-v${fileVersion}`;

  useEffect(() => {
    if (!currentProject) return;
    apiFetch(`/deploy/${currentProject}/domains`, {}, getToken)
      .then((r) => r.json())
      .then((data) => {
        if (data.persistentDomain) {
          setPublishState({ publishDomain: data.persistentDomain });
        }
        const displayUrl = normalizePublishUrl(data.primaryUrl);
        if (displayUrl) {
          setPublishState({ publishStatus: 'published', publishUrl: displayUrl });
        }
      })
      .catch(() => {});
  }, [currentProject, getToken, setPublishState]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (publishPanelRef.current && !publishPanelRef.current.contains(e.target as Node)) {
        setShowPublishPanel(false);
      }
    }
    if (showPublishPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPublishPanel]);

  const handleFixWithAgent = useCallback(
    async (errorMsg: string) => {
      if (!currentProject) return;
      setIsFixing(true);
      setEditStatus('Fixing error...');
      try {
        const res = await apiFetch(
          '/ai/fix',
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: currentProject,
              error: errorMsg,
              autoFix: true,
            }),
          },
          getToken,
        );

        if (!res.ok) {
          setEditStatus('Fix failed — try describing the issue in the chat below.');
          setTimeout(() => setEditStatus(null), 4000);
          return;
        }

        const data = await res.json();
        if (data.fixed && data.files) {
          setProjectFiles(data.files);
          incrementFileVersion();
          setEditStatus('Fix applied — preview updating...');
        } else if (data.files) {
          setProjectFiles(data.files);
          incrementFileVersion();
          setEditStatus('Attempted fix — check the preview.');
        } else {
          setEditStatus('Could not fix automatically. Describe the issue below.');
        }
        setTimeout(() => setEditStatus(null), 3000);
      } catch {
        setEditStatus('Fix failed — server error.');
        setTimeout(() => setEditStatus(null), 4000);
      } finally {
        setIsFixing(false);
      }
    },
    [currentProject, getToken, setProjectFiles, incrementFileVersion],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!currentProject) return;

    setPublishState({ publishStatus: 'publishing', publishError: null });
    stopPolling();

    try {
      const res = await apiFetch(
        `/deploy/${currentProject}`,
        {
          method: 'POST',
          body: JSON.stringify({
            platform: 'vercel',
            files: projectFiles,
          }),
        },
        getToken,
      );

      const data = await res.json();

      if (!res.ok || data.error) {
        setPublishState({ publishStatus: 'error', publishError: data.error ?? 'Deployment failed' });
        return;
      }

      const liveUrl = normalizePublishUrl(data.liveUrl ?? data.url);
      const initialPublishUrl =
        liveUrl && !isVercelDeploymentPreviewUrl(liveUrl) ? liveUrl : null;
      const status: PublishStatus = data.status === 'ready' ? 'published' : 'publishing';
      setPublishState({
        publishStatus: status,
        publishUrl: initialPublishUrl,
        publishDomain: data.persistentDomain || null,
        publishDeploymentId: data.deploymentId || null,
      });

      if (data.status === 'ready') return;

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await apiFetch(
            `/deploy/${currentProject}/${data.deploymentId}/status`,
            {},
            getToken,
          );
          const statusData = await statusRes.json();

          if (statusData.status === 'ready') {
            const polledUrl = normalizePublishUrl(statusData.liveUrl ?? statusData.url);
            const nextUrl =
              polledUrl && !isVercelDeploymentPreviewUrl(polledUrl)
                ? polledUrl
                : initialPublishUrl ?? liveUrl;
            setPublishState({
              publishStatus: 'published',
              publishUrl: nextUrl,
            });
            stopPolling();
          } else if (statusData.status === 'error') {
            setPublishState({ publishStatus: 'error', publishError: 'Build failed — your site could not be published through Vocaweb' });
            stopPolling();
          }
        } catch {
          setPublishState({ publishStatus: 'error', publishError: 'Lost connection while checking status' });
          stopPolling();
        }
      }, 3000);
    } catch {
      setPublishState({ publishStatus: 'error', publishError: 'Could not connect to the deployment server' });
    }
  }, [currentProject, stopPolling, getToken, projectFiles, setPublishState]);

  const handleSaveSubdomain = useCallback(async () => {
    if (!currentProject || !subdomainInput.trim()) return;

    const slug = subdomainInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    if (slug.length < 3) return;

    setDomainSaving(true);
    try {
      const baseDomain =
        publishDomain?.split('.').slice(1).join('.') ||
        getDeployBaseDomain();
      if (!baseDomain) return;
      const fullDomain = `${slug}.${baseDomain}`;

      const res = await apiFetch(
        `/deploy/${currentProject}/domain`,
        {
          method: 'POST',
          body: JSON.stringify({ domain: fullDomain }),
        },
        getToken,
      );

      if (res.ok) {
        setPublishState({ publishDomain: fullDomain });
        setIsEditingDomain(false);
      }
    } catch {
      // silent fail
    } finally {
      setDomainSaving(false);
    }
  }, [currentProject, subdomainInput, publishDomain, getToken, setPublishState]);

  const copyUrl = useCallback(() => {
    const url = resolvePublishDisplayUrl(publishDomain, publishUrl);
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  }, [publishDomain, publishUrl]);

  const handleFileSelect = useCallback(
    (path: string) => {
      setActiveFile(path);
      setSandboxViewMode('code');
      setSandboxSidebarOpen(true);
    },
    [setActiveFile, setSandboxViewMode, setSandboxSidebarOpen],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      let instruction = text.trim();
      if (selectedElement) {
        instruction = `Target element: ${selectedElement.selector} (<${selectedElement.tagName}>${
          selectedElement.text ? `, text: "${selectedElement.text.slice(0, 80)}"` : ''
        }). Change request: ${instruction}`;
      }

      setInput('');
      setSandboxMessages((prev) => [...prev, { role: 'user', text: text.trim() }]);
      setIsLoading(true);
      setEditStatus('Editing...');

      if (!currentProject) {
        const errMsg = 'No project open — build a site first.';
        setEditStatus(errMsg);
        setSandboxMessages((prev) => [...prev, { role: 'assistant', text: errMsg }]);
        setIsLoading(false);
        setTimeout(() => setEditStatus(null), 3000);
        return;
      }

      try {
        const res = await apiFetch(
          '/ai/edit',
          {
            method: 'POST',
            body: JSON.stringify({
              projectId: currentProject,
              instruction,
            }),
          },
          getToken,
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg = `Edit failed: ${(err as { error?: string }).error ?? res.statusText}`;
          setEditStatus(errMsg);
          setSandboxMessages((prev) => [...prev, { role: 'assistant', text: errMsg }]);
          setTimeout(() => setEditStatus(null), 4000);
          return;
        }

        const data = await res.json();

        if (data.files) {
          setProjectFiles(data.files);
          incrementFileVersion();
        }

        const appliedCount = data.applied ?? 0;
        const successMsg =
          appliedCount > 0
            ? `Applied ${appliedCount} change${appliedCount > 1 ? 's' : ''}. Preview is updating.`
            : 'No code changes were needed for that request.';
        setEditStatus(successMsg);
        setSandboxMessages((prev) => [...prev, { role: 'assistant', text: successMsg }]);
        setTimeout(() => setEditStatus(null), 3000);
      } catch {
        const errMsg = 'Could not connect to the server.';
        setEditStatus(errMsg);
        setSandboxMessages((prev) => [...prev, { role: 'assistant', text: errMsg }]);
        setTimeout(() => setEditStatus(null), 4000);
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentProject,
      isLoading,
      selectedElement,
      getToken,
      setProjectFiles,
      incrementFileVersion,
    ],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const activeContent = activeFile ? projectFiles[activeFile] ?? '' : '';

  const isPublished = publishStatus === 'published';
  const isPublishing = publishStatus === 'publishing';
  const displayUrl = resolvePublishDisplayUrl(publishDomain, publishUrl);
  const baseDomain =
    publishDomain?.split('.').slice(1).join('.') ||
    getDeployBaseDomain();
  const currentSlug = publishDomain?.split('.')[0] || '';

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between max-md:flex-col max-md:items-stretch max-md:gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={resetProject}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            New Project
          </button>
          <div className="h-4 w-px bg-[var(--border)]/30 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {isBuilding || isFixing ? 'Building...' : 'Live Preview'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          {/* Publish Button */}
          <button
            onClick={() => {
              if (isPublished) {
                setShowPublishPanel((v) => !v);
              } else if (!isPublishing) {
                handlePublish();
                setShowPublishPanel(true);
              }
            }}
            disabled={!currentProject || fileCount === 0 || isPublishing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isPublished
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : isPublishing
                  ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                  : 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90'
            }`}
          >
            {isPublishing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPublished ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            {isPublishing ? 'Publishing...' : isPublished ? 'Published' : 'Publish'}
          </button>

          {/* Publish Panel (popover) */}
          <AnimatePresence>
            {showPublishPanel && (
              <motion.div
                ref={publishPanelRef}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-[var(--border)]/40 bg-[var(--card)] shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[var(--border)]/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {isPublished ? 'Published to the Web' : isPublishing ? 'Publishing...' : publishStatus === 'error' ? 'Publish Failed' : 'Publish to the Web'}
                    </h3>
                    <button
                      onClick={() => setShowPublishPanel(false)}
                      className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isPublishing && (
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Deploying your website through Vocaweb...</p>
                  )}
                  {publishStatus === 'error' && publishError && (
                    <p className="text-[11px] text-red-400 mt-0.5">{publishError}</p>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  {/* Domain row */}
                  <div className="rounded-lg border border-[var(--border)]/30 bg-[var(--muted)]/20">
                    <button
                      onClick={() => {
                        setSubdomainInput(currentSlug);
                        setIsEditingDomain((v) => !v);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Pencil className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                        <span className="text-xs font-medium text-[var(--foreground)] truncate">Customize Domain</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 text-[var(--muted-foreground)] transition-transform ${isEditingDomain ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isEditingDomain && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-2">
                            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)]/40 bg-[var(--background)] px-2 py-1.5">
                              <input
                                value={subdomainInput}
                                onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="my-site"
                                maxLength={30}
                                className="flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none min-w-0"
                              />
                              {baseDomain ? (
                                <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">.{baseDomain}</span>
                              ) : null}
                            </div>
                            {subdomainInput.length > 0 && subdomainInput.length < 3 && (
                              <p className="text-[10px] text-amber-400">Minimum 3 characters</p>
                            )}
                            <button
                              onClick={handleSaveSubdomain}
                              disabled={domainSaving || subdomainInput.length < 3}
                              className="w-full py-1.5 rounded-lg text-[11px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            >
                              {domainSaving ? 'Saving...' : 'Save Domain'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Live URL display */}
                  {displayUrl && (
                    <div className="rounded-lg border border-[var(--border)]/30 bg-[var(--muted)]/20 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] text-[var(--muted-foreground)] mb-0.5">Live URL</p>
                          <p className="text-xs text-[var(--foreground)] truncate">{displayUrl}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={copyUrl}
                            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Publish / Re-deploy button */}
                  {isPublished ? (
                    <button
                      onClick={() => {
                        handlePublish();
                      }}
                      disabled={isPublishing}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-[var(--border)]/30 text-[var(--foreground)] hover:bg-[var(--muted)]/30 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Update Deployment
                    </button>
                  ) : publishStatus === 'error' ? (
                    <button
                      onClick={handlePublish}
                      className="w-full py-2 rounded-lg text-xs font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity"
                    >
                      Retry Publish
                    </button>
                  ) : isPublishing ? (
                    <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--muted-foreground)]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary)]" />
                      Deploying your website through Vocaweb...
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setSandboxSidebarOpen(!sandboxSidebarOpen)}
            className="p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
            title={sandboxSidebarOpen ? 'Hide code files' : 'Show code files'}
          >
            {sandboxSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setEditPanelOpen(!editPanelOpen)}
            className="hidden md:flex p-2 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
            title={editPanelOpen ? 'Hide AI panel' : 'Show AI panel'}
          >
            {editPanelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main area — file tree | preview/code | AI panel */}
      <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden max-md:flex-col max-md:min-h-[50vh]">
        {sandboxSidebarOpen && fileCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden shrink-0 max-h-40 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md overflow-hidden"
          >
            <FileExplorer
              files={projectFiles}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
            />
          </motion.div>
        )}

        {sandboxSidebarOpen && fileCount > 0 && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block shrink-0 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md overflow-hidden"
          >
            <FileExplorer
              files={projectFiles}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
            />
          </motion.div>
        )}

        <div className="flex-1 min-w-0 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md overflow-hidden">
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)]/30">
            <button
              onClick={() => setSandboxViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                sandboxViewMode === 'preview'
                  ? 'bg-[var(--primary)]/20 text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Monitor className="w-3 h-3" />
              Live
            </button>
            {fileCount > 0 && (
              <button
                onClick={() => {
                  setSandboxViewMode('code');
                  setSandboxSidebarOpen(true);
                  if (!activeFile) {
                    const first = Object.keys(projectFiles)[0];
                    if (first) setActiveFile(first);
                  }
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  sandboxViewMode === 'code'
                    ? 'bg-[var(--primary)]/20 text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Code
              </button>
            )}
          </div>

          <div className="h-[calc(100%-36px)] max-md:h-[min(60vh,500px)]">
            {sandboxViewMode === 'code' && fileCount > 0 ? (
              <CodeViewer filePath={activeFile} content={activeContent} />
            ) : fileCount > 0 ? (
              <WebContainerPreview
                key={previewKey}
                files={projectFiles}
                fileVersion={fileVersion}
                projectId={currentProject}
                onFixWithAgent={currentProject ? handleFixWithAgent : undefined}
                inspectMode={inspectMode}
                onElementSelect={(el) => {
                  setSelectedElement(el);
                  setInspectMode(false);
                  setEditPanelOpen(true);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">
                Start a conversation to build your site
              </div>
            )}
          </div>
        </div>

        {editPanelOpen && fileCount > 0 && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:flex shrink-0 rounded-xl border border-[var(--border)]/30 overflow-hidden min-h-0"
          >
            <SandboxEditPanel
              selectedElement={selectedElement}
              inspectMode={inspectMode}
              onToggleInspect={() => {
                if (sandboxViewMode !== 'preview') setSandboxViewMode('preview');
                setInspectMode((v) => !v);
              }}
              onClearSelection={() => setSelectedElement(null)}
              messages={sandboxMessages}
              input={input}
              onInputChange={setInput}
              onSubmit={() => void sendMessage(input)}
              isLoading={isLoading}
              editStatus={editStatus}
              disabled={!currentProject}
            />
          </motion.div>
        )}
      </div>

      {/* Mobile bottom chat — desktop uses right panel */}
      <div className="md:hidden rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md px-4 py-2.5 space-y-1.5">
        <AnimatePresence>
          {editStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"
            >
              {(isLoading || isFixing) && (
                <Loader2 className="w-3 h-3 animate-spin text-[var(--primary)] shrink-0" />
              )}
              <span>{editStatus}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={currentProject ? 'Ask Vocaweb to edit, improve, or add features...' : 'Build a site first, then edit here...'}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
