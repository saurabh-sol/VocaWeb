'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthSession } from '@/lib/auth';
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
import { apiFetch, describeApiError } from '@/lib/api';
import { normalizePublishUrl, resolvePublishDisplayUrl, isVercelDeploymentPreviewUrl } from '@/lib/utils';
import { getDeployBaseDomain } from '@/lib/deploy-domain';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

export function SandboxLayout() {
  const { getToken } = useAuthSession();

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
          setEditStatus('The fix failed. Try describing the problem in the edit panel.');
          setTimeout(() => setEditStatus(null), 4000);
          return;
        }

        const data = await res.json();
        if (data.fixed && data.files) {
          setProjectFiles(data.files);
          incrementFileVersion();
          setEditStatus('Fix applied. The preview is updating.');
        } else if (data.files) {
          setProjectFiles(data.files);
          incrementFileVersion();
          setEditStatus('A fix was attempted. Check the preview.');
        } else {
          setEditStatus('Could not fix automatically. Describe the issue below.');
        }
        setTimeout(() => setEditStatus(null), 3000);
      } catch {
        setEditStatus('The fix failed because of a server error.');
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
            setPublishState({ publishStatus: 'error', publishError: 'The build failed, so the site could not be published.' });
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
        const errMsg = 'No project is open. Build a site first.';
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
          const err = await res.json().catch(() => null);
          const errMsg = describeApiError(err, `The edit failed (${res.statusText}).`);
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

  const pane = 'vw-card-flat overflow-hidden';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={resetProject} className="shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            New project
          </Button>
          <Tag tone={isBuilding || isFixing ? 'warn' : 'ok'}>
            {isBuilding || isFixing ? 'Building' : 'Live preview'}
          </Tag>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant={isPublished ? 'secondary' : 'primary'}
            onClick={() => {
              if (isPublished) {
                setShowPublishPanel((v) => !v);
              } else if (!isPublishing) {
                handlePublish();
                setShowPublishPanel(true);
              }
            }}
            disabled={!currentProject || fileCount === 0 || isPublishing}
            aria-expanded={showPublishPanel}
            className={cn(isPublished && '!border-ok !text-ok')}
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isPublished ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Globe className="h-3.5 w-3.5" aria-hidden />
            )}
            {isPublishing ? 'Publishing' : isPublished ? 'Published' : 'Publish'}
          </Button>

          {/* Publish popover */}
          <AnimatePresence>
            {showPublishPanel && (
              <motion.div
                ref={publishPanelRef}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-[10px] border-[1.5px] border-rule bg-paper shadow-hard-lg max-md:left-0 max-md:w-auto"
              >
                <div className="border-b-[1.5px] border-rule px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {isPublished
                        ? 'Published to the web'
                        : isPublishing
                          ? 'Publishing'
                          : publishStatus === 'error'
                            ? 'Publishing failed'
                            : 'Publish to the web'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPublishPanel(false)}
                      aria-label="Close"
                      className="rounded p-0.5 text-dim transition-colors hover:bg-wash hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  {isPublishing && (
                    <p className="mt-0.5 text-[11.5px] text-dim" role="status">
                      Deploying your website
                    </p>
                  )}
                  {publishStatus === 'error' && publishError && (
                    <p className="mt-0.5 text-[11.5px] text-bad" role="alert">
                      {publishError}
                    </p>
                  )}
                </div>

                <div className="space-y-2 p-3">
                  {/* Domain row */}
                  <div className="vw-card-soft">
                    <button
                      type="button"
                      aria-expanded={isEditingDomain}
                      onClick={() => {
                        setSubdomainInput(currentSlug);
                        setIsEditingDomain((v) => !v);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden />
                        <span className="truncate text-xs font-semibold">Choose the address</span>
                      </span>
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 text-dim transition-transform',
                          isEditingDomain && 'rotate-90',
                        )}
                        aria-hidden
                      />
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
                          <div className="space-y-2 px-3 pb-3">
                            <div className="flex items-center gap-1 rounded-lg border-[1.5px] border-rule bg-paper px-2 py-1.5 focus-within:shadow-hard-brand">
                              <input
                                value={subdomainInput}
                                onChange={(e) =>
                                  setSubdomainInput(
                                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                  )
                                }
                                aria-label="Site name"
                                placeholder="my-site"
                                maxLength={30}
                                className="min-w-0 flex-1 bg-transparent font-mono text-xs placeholder:text-faint focus:outline-none"
                              />
                              {baseDomain ? (
                                <span className="shrink-0 font-mono text-[10.5px] text-dim">
                                  .{baseDomain}
                                </span>
                              ) : null}
                            </div>
                            {subdomainInput.length > 0 && subdomainInput.length < 3 && (
                              <p className="text-[11px] text-warn">Use at least 3 characters</p>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleSaveSubdomain}
                              disabled={subdomainInput.length < 3}
                              loading={domainSaving}
                              className="w-full"
                            >
                              {domainSaving ? 'Saving' : 'Save address'}
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Live URL */}
                  {displayUrl && (
                    <div className="vw-card-soft bg-wash px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="vw-kicker mb-0.5 text-[10px]">Live address</p>
                          <p className="truncate font-mono text-xs">{displayUrl}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={copyUrl}
                            aria-label="Copy the address"
                            title="Copy the address"
                            className="rounded-md p-1.5 text-dim transition-colors hover:bg-paper hover:text-ink"
                          >
                            {copiedUrl ? (
                              <Check className="h-3.5 w-3.5 text-ok" aria-hidden />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                          <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open the site in a new tab"
                            title="Open in a new tab"
                            className="rounded-md p-1.5 text-dim transition-colors hover:bg-paper hover:text-ink"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {isPublished ? (
                    <Button size="sm" onClick={handlePublish} disabled={isPublishing} className="w-full">
                      <RotateCw className="h-3.5 w-3.5" aria-hidden />
                      Update the live site
                    </Button>
                  ) : publishStatus === 'error' ? (
                    <Button variant="primary" size="sm" onClick={handlePublish} className="w-full">
                      Try publishing again
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSandboxSidebarOpen(!sandboxSidebarOpen)}
            aria-pressed={sandboxSidebarOpen}
            aria-label={sandboxSidebarOpen ? 'Hide the file list' : 'Show the file list'}
            title={sandboxSidebarOpen ? 'Hide the file list' : 'Show the file list'}
          >
            {sandboxSidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeft className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditPanelOpen(!editPanelOpen)}
            aria-pressed={editPanelOpen}
            aria-label={editPanelOpen ? 'Hide the edit panel' : 'Show the edit panel'}
            title={editPanelOpen ? 'Hide the edit panel' : 'Show the edit panel'}
            className="max-md:hidden"
          >
            {editPanelOpen ? (
              <PanelRightClose className="h-4 w-4" aria-hidden />
            ) : (
              <PanelRight className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {/* File list, preview or code, edit panel */}
      <div className="flex min-h-0 flex-1 flex-row gap-3 overflow-hidden max-md:min-h-[50vh] max-md:flex-col">
        {sandboxSidebarOpen && fileCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(pane, 'max-h-40 shrink-0 md:hidden')}
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
            animate={{ width: 228, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(pane, 'hidden shrink-0 md:block')}
          >
            <FileExplorer
              files={projectFiles}
              activeFile={activeFile}
              onFileSelect={handleFileSelect}
            />
          </motion.div>
        )}

        <div className="vw-card min-w-0 flex-1 overflow-hidden">
          <div
            role="tablist"
            aria-label="Sandbox view"
            className="flex items-center gap-1 border-b-[1.5px] border-rule px-3 py-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sandboxViewMode === 'preview'}
              data-active={sandboxViewMode === 'preview'}
              onClick={() => setSandboxViewMode('preview')}
              className="vw-navlink !h-7 !rounded-md !px-2.5 !text-xs"
            >
              <Monitor className="h-3 w-3" aria-hidden />
              Live
            </button>
            {fileCount > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={sandboxViewMode === 'code'}
                data-active={sandboxViewMode === 'code'}
                onClick={() => {
                  setSandboxViewMode('code');
                  setSandboxSidebarOpen(true);
                  if (!activeFile) {
                    const first = Object.keys(projectFiles)[0];
                    if (first) setActiveFile(first);
                  }
                }}
                className="vw-navlink !h-7 !rounded-md !px-2.5 !text-xs"
              >
                Code
              </button>
            )}
          </div>

          <div className="h-[calc(100%-42px)] max-md:h-[min(60vh,500px)]">
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
              <div className="flex h-full items-center justify-center text-sm text-dim">
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
            className={cn(pane, 'hidden min-h-0 shrink-0 md:flex')}
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

      {/* Small screens edit from a bar at the bottom; larger ones use the side panel. */}
      <div className={cn(pane, 'space-y-1.5 px-3 py-2.5 md:hidden')}>
        <AnimatePresence>
          {editStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="status"
              className="flex items-center gap-2 font-mono text-[11.5px] text-dim"
            >
              {(isLoading || isFixing) && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
              )}
              <span>{editStatus}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="sandbox-mobile-input" className="sr-only">
            Edit instructions
          </label>
          <input
            id="sandbox-mobile-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={currentProject ? 'Describe a change to your site' : 'Build a site first'}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-faint focus:outline-none disabled:opacity-50"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={isLoading || !input.trim()}
            aria-label="Apply the edit"
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
