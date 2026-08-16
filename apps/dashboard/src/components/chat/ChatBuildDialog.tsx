'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Loader2,
  RotateCcw,
  ArrowLeft,
  Hammer,
  ClipboardList,
  Rocket,
  Layers,
  Link2,
  Check,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { ConversationMessage } from '@/components/shared/ConversationMessage';
import { usePrivy } from '@privy-io/react-auth';
import { useAppStore, useHydrated, type ChatMessage, type ModelTier } from '@/store';
import { apiFetch } from '@/lib/api';
import { streamBuild } from '@/lib/stream-build';
import { syncChatMessage, ensureSessionMessages, isDbSessionId } from '@/lib/conversations';
import { ImportSourceModal } from '@/components/integrations/ImportSourceModal';
import { ModelSelector } from '@/components/shared/ModelSelector';
import {
  fetchIntegrations,
  connectIntegration,
  connectCanvaMcp,
  type IntegrationStatus,
} from '@/lib/integrations';
import type { IntegrationProvider } from '@/lib/shared-types';

function PlanCard({
  plan,
  onConfirm,
  onEdit,
  isLoading,
}: {
  plan: string;
  onConfirm: () => void;
  onEdit: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--primary)]/20 bg-[var(--primary)]/10">
        <ClipboardList className="w-4 h-4 text-[var(--primary)]" />
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          Build Plan
        </span>
      </div>
      <div className="px-4 py-3 chat-markdown prose prose-sm prose-invert max-w-none">
        <ReactMarkdown
          allowedElements={['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'br', 'h3', 'h4']}
          unwrapDisallowed
        >
          {plan}
        </ReactMarkdown>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--primary)]/20 max-md:flex-col max-md:items-stretch">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Rocket className="w-3.5 h-3.5" />
          Build This
        </motion.button>
        <button
          onClick={onEdit}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors disabled:opacity-50"
        >
          Change Plan
        </button>
      </div>
    </motion.div>
  );
}

export function ChatBuildDialog() {
  const hydrated = useHydrated();
  const { getAccessToken, authenticated: isSignedIn, user } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  const walletAddress = user?.wallet?.address ?? null;
  const selectedModel = useAppStore((s) => s.selectedModel);
  
  const initialPrompt = useAppStore((s) => s.initialPrompt);
  const setInitialPrompt = useAppStore((s) => s.setInitialPrompt);
  const buildPlan = useAppStore((s) => s.buildPlan);
  const chatHistory = useAppStore((s) => s.chatHistory);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const clearChat = useAppStore((s) => s.clearChat);
  const agentMode = useAppStore((s) => s.agentMode);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const setBuildPlan = useAppStore((s) => s.setBuildPlan);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const mergeProjectFiles = useAppStore((s) => s.mergeProjectFiles);
  const enterLiveBuild = useAppStore((s) => s.enterLiveBuild);
  const finishBuild = useAppStore((s) => s.finishBuild);
  const isBuilding = useAppStore((s) => s.isBuilding);
  const dbChatSessionId = useAppStore((s) => s.dbChatSessionId);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setDbChatSessionId = useAppStore((s) => s.setDbChatSessionId);
  const linkActiveSessionToDb = useAppStore((s) => s.linkActiveSessionToDb);
  const currentProject = useAppStore((s) => s.currentProject);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latestPlan, setLatestPlan] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const didSendInitial = useRef(false);
  const didRestoreSession = useRef(false);

  const loadIntegrations = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const list = await fetchIntegrations(getToken);
      setIntegrations(list);
    } catch {
      setIntegrations([]);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (hydrated && isSignedIn) void loadIntegrations();
  }, [hydrated, isSignedIn, loadIntegrations]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('integration') === 'connected' ||
      params.get('integration') === 'mcp_connected'
    ) {
      void loadIntegrations();
    }
  }, [loadIntegrations]);

  useEffect(() => {
    if (!hydrated || !isSignedIn || didRestoreSession.current) return;
    const sessionId = activeSessionId ?? dbChatSessionId;
    if (!sessionId || !isDbSessionId(sessionId) || chatHistory.length > 0) return;

    didRestoreSession.current = true;
    void (async () => {
      const session = useAppStore.getState().chatSessions.find((s) => s.id === sessionId);
      if (!session) return;
      const full = await ensureSessionMessages(session, getToken);
      if (full.messages.length > 0) {
        useAppStore.setState({ chatHistory: full.messages });
      }
    })();
  }, [hydrated, isSignedIn, activeSessionId, dbChatSessionId, chatHistory.length, getToken]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatHistory, isLoading, latestPlan]);

  const runDirectBuild = useCallback(
    async (planText: string, userLabel: string) => {
      enterLiveBuild();
      const currentFiles = useAppStore.getState().projectFiles;
      addChatMessage({ role: 'user', text: userLabel });
      setIsLoading(true);

      try {
        await streamBuild(planText, {
          channel: 'chat',
          sessionId: dbChatSessionId,
          projectId: currentProject ?? undefined,
          getToken,
          initialFiles: currentFiles,
          model: selectedModel,
          walletAddress,
          onFile: (_path, _content, files) => {
            mergeProjectFiles(files);
          },
          onDone: async (result) => {
            addChatMessage({
              role: 'assistant',
              text: 'Your website is ready! Watch it come alive in the live preview.',
              filesGenerated: result.filesGenerated,
              skillsUsed: result.skillsUsed,
            });
            setCurrentProject(result.projectId);
            setProjectFiles(result.files);
            finishBuild();
            setBuildPlan(null);
            setAgentMode('sandbox');
            const sid = await syncChatMessage(
              dbChatSessionId,
              'assistant',
              'Built website from plan.',
              getToken,
              { filesGenerated: result.filesGenerated, skillsUsed: result.skillsUsed },
              result.projectId,
            );
            if (sid) setDbChatSessionId(sid);
          },
          onError: (message) => {
            finishBuild();
            addChatMessage({
              role: 'assistant',
              text: `Something went wrong: ${message}`,
            });
          },
        });
      } catch {
        addChatMessage({
          role: 'assistant',
          text: 'Could not connect to the server. Make sure the backend is running.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      enterLiveBuild,
      addChatMessage,
      getToken,
      setCurrentProject,
      setProjectFiles,
      mergeProjectFiles,
      finishBuild,
      dbChatSessionId,
      setDbChatSessionId,
      setAgentMode,
      setBuildPlan,
      selectedModel,
      walletAddress,
    ],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: 'user', text: text.trim() };
      const isBuildConfirm =
        /^(yes|yeah|yep|sure|ok|okay|build it|go ahead|looks good|start building|do it|let'?s go)/i.test(
          text.trim(),
        );

      if (isBuildConfirm && buildPlan) {
        await runDirectBuild(buildPlan, text.trim());
        setInput('');
        return;
      }

      if (isBuildConfirm) {
        enterLiveBuild();
      }

      addChatMessage(userMsg);
      setInput('');
      setIsLoading(true);

      try {
        const allMessages = [...chatHistory, userMsg].map((m) => ({
          role: m.role,
          content: m.text,
        }));

        const res = await apiFetch(
          '/ai/chat',
          {
            method: 'POST',
            body: JSON.stringify({
              messages: allMessages,
              sessionId: dbChatSessionId ?? undefined,
              projectId: currentProject ?? undefined,
              model: selectedModel,
              walletAddress: walletAddress ?? undefined,
            }),
          },
          getToken,
        );

        const data = await res.json();

        if (res.status === 403 && data.error === 'access_denied') {
          addChatMessage({
            role: 'assistant',
            text: `Access denied: ${data.message}`,
          });
          return;
        }

        if (data.sessionId) {
          linkActiveSessionToDb(data.sessionId);
        }

        // Handle image generation intent
        if (data.intent === 'import_sources' || data.showImportModal) {
          addChatMessage({ role: 'assistant', text: data.reply ?? '' });
          setImportOpen(true);
          return;
        }

        if (data.intent === 'generate_image') {
          addChatMessage({ role: 'assistant', text: '🎨 Generating your image...' });
          setIsLoading(true);
          try {
            const imgRes = await apiFetch('/ai/image', { method: 'POST', body: JSON.stringify({ prompt: data.reply }) }, getToken);
            const imgData = await imgRes.json();
            // Remove "Generating..." placeholder
            const curr = useAppStore.getState().chatHistory;
            useAppStore.setState({ chatHistory: curr.slice(0, -1) });
            if (imgData.imageUrl) {
              addChatMessage({ role: 'assistant', text: 'Here\'s your generated image:', images: [imgData.imageUrl] });
            } else {
              addChatMessage({ role: 'assistant', text: `Image generation failed: ${imgData.error || 'Unknown error'}` });
            }
          } catch {
            addChatMessage({ role: 'assistant', text: 'Failed to generate image. Please try again.' });
          }
          return;
        }

        if (data.error) {
          addChatMessage({
            role: 'assistant',
            text: `Something went wrong: ${data.error}`,
          });
          return;
        }

        if (data.plan) {
          const plan = data.plan;
          setLatestPlan(plan);
          setBuildPlan(plan);
          setAgentMode('planning');
          addChatMessage({
            role: 'assistant',
            text: data.reply || "Here's my plan for your website:",
            plan,
          });
        } else if (data.shouldBuild && data.buildResult) {
          addChatMessage({
            role: 'assistant',
            text: data.reply || 'Your website is ready! Watch it come alive in the live preview.',
            filesGenerated: data.buildResult.filesGenerated,
            skillsUsed: data.buildResult.skillsUsed,
          });

          if (data.buildResult.projectId && data.buildResult.files) {
            setCurrentProject(data.buildResult.projectId);
            setProjectFiles(data.buildResult.files);
            finishBuild();
            setAgentMode('sandbox');
          }
        } else {
          addChatMessage({
            role: 'assistant',
            text: data.reply ?? '',
            images: data.images,
          });
        }
      } catch {
        addChatMessage({
          role: 'assistant',
          text: 'Could not connect to the server. Make sure the backend is running.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      chatHistory,
      addChatMessage,
      isLoading,
      setAgentMode,
      setBuildPlan,
      setCurrentProject,
      setProjectFiles,
      enterLiveBuild,
      buildPlan,
      runDirectBuild,
      getToken,
      dbChatSessionId,
      setDbChatSessionId,
      linkActiveSessionToDb,
      currentProject,
      selectedModel,
      walletAddress,
    ],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (initialPrompt && !didSendInitial.current && chatHistory.length === 0) {
      didSendInitial.current = true;
      const prompt = initialPrompt;
      setInitialPrompt(null);
      sendMessage(prompt);
    }
  }, [hydrated, initialPrompt, chatHistory.length, setInitialPrompt, sendMessage]);

  const handleConfirmBuild = useCallback(() => {
    setLatestPlan(null);
    const planText =
      buildPlan ??
      latestPlan ??
      chatHistory
        .filter((m) => m.plan)
        .map((m) => m.plan)
        .pop() ??
      chatHistory.find((m) => m.role === 'user')?.text ??
      '';
    if (!planText.trim()) return;
    void runDirectBuild(planText, 'Yes, build it!');
  }, [buildPlan, latestPlan, chatHistory, runDirectBuild]);

  const handleEditPlan = useCallback(() => {
    setLatestPlan(null);
    inputRef.current?.focus();
  }, []);

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

  const handleNewChat = () => {
    clearChat();
    setLatestPlan(null);
    setAgentMode('chat');
    setBuildPlan(null);
  };

  const modeLabel =
    isBuilding
      ? 'Building...'
      : agentMode === 'planning'
        ? 'Plan Mode'
        : isLoading
          ? 'Thinking...'
          : 'AI Website Builder';

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]/30 bg-transparent max-md:px-3 max-md:py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/"
            className="p-2 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-10 w-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
            {isBuilding ? (
              <Hammer className="h-5 w-5 text-[var(--primary-foreground)] animate-pulse" />
            ) : (
              <Hammer className="h-5 w-5 text-[var(--primary-foreground)]" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--foreground)]">Vocaweb</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-[var(--muted-foreground)]">{modeLabel}</p>
              {agentMode === 'planning' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 uppercase tracking-wider">
                  Plan
                </span>
              )}
              {isBuilding && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 uppercase tracking-wider">
                  Build
                </span>
              )}
            </div>
          </div>
          <ModelSelector />
        </div>

        {chatHistory.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Layers className="w-3 h-3" />
              Import
            </button>
            <button
              onClick={handleNewChat}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              New Chat
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 max-md:px-3">
        {chatHistory.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <div className="h-16 w-16 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Send className="h-7 w-7 text-[var(--muted-foreground)]" />
            </div>
            <div>
              <p className="text-lg font-medium text-[var(--foreground)] mb-1">
                Tell Vocaweb what to build
              </p>
              <p className="text-sm text-[var(--muted-foreground)] max-w-md">
                Describe your website idea. I&apos;ll create a plan, and once you approve, I&apos;ll
                build it for you.
              </p>
            </div>
          </div>
        )}

        {(chatHistory.length > 0 || isLoading) && (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {chatHistory.map((msg, i) => (
                <ConversationMessage key={`msg-${i}`} role={msg.role}>
                  {msg.role === 'assistant' ? (
                    <div className="chat-markdown prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        allowedElements={['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'br', 'h3', 'h4']}
                        unwrapDisallowed
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}

                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {msg.images.map((src, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={src}
                          alt="Generated image"
                          className="rounded-xl max-w-full w-full shadow-lg border border-[var(--border)]/30"
                          style={{ maxHeight: '400px', objectFit: 'contain' }}
                        />
                      ))}
                    </div>
                  )}

                  {msg.plan && i === chatHistory.length - 1 && latestPlan && (
                    <div className="mt-3">
                      <PlanCard
                        plan={msg.plan}
                        onConfirm={handleConfirmBuild}
                        onEdit={handleEditPlan}
                        isLoading={isLoading}
                      />
                    </div>
                  )}

                  {msg.filesGenerated && msg.filesGenerated > 0 && agentMode === 'chat' && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5 opacity-80">
                      {msg.filesGenerated} files generated
                      {msg.skillsUsed?.length ? ` · ${msg.skillsUsed.length} skills used` : ''}
                    </p>
                  )}
                </ConversationMessage>
              ))}
            </AnimatePresence>

            {isLoading && (
              <ConversationMessage role="assistant">
                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isBuilding ? 'Building your website...' : 'Thinking...'}</span>
                </div>
              </ConversationMessage>
            )}
          </div>
        )}
      </div>

      {/* Connect Panel */}
      <AnimatePresence>
        {showConnectPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[var(--border)]/30 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Connect Integrations
                </p>
                <button
                  onClick={() => setShowConnectPanel(false)}
                  className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['notion', 'canva', 'figma'] as IntegrationProvider[]).map((provider) => {
                  const status = integrations.find((i) => i.provider === provider);
                  const connected = status?.connected ?? false;
                  const configured = status?.configured ?? false;
                  const mcpConnected = status?.mcpConnected ?? false;
                  const mcpConfigured = status?.mcpConfigured ?? false;

                  return (
                    <div
                      key={provider}
                      className="rounded-xl border border-[var(--border)]/30 p-3 space-y-2 bg-[var(--background)]/30"
                    >
                      <p className="text-xs font-medium capitalize">{provider}</p>
                      {!configured ? (
                        <p className="text-[10px] text-amber-400">Not configured</p>
                      ) : connected ? (
                        <div className="space-y-1">
                          <span className="text-[10px] text-green-400 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> REST
                          </span>
                          {mcpConfigured && (
                            <span
                              className={`text-[10px] flex items-center gap-1 ${
                                mcpConnected ? 'text-green-400' : 'text-[var(--muted-foreground)]'
                              }`}
                            >
                              MCP {mcpConnected ? 'on' : provider === 'canva' ? '' : 'ready'}
                            </span>
                          )}
                          {provider === 'canva' && mcpConfigured && !mcpConnected && (
                            <button
                              onClick={async () => {
                                const url = await connectCanvaMcp(
                                  getToken,
                                  window.location.href,
                                );
                                if (url) window.location.href = url;
                              }}
                              className="text-[10px] text-[var(--primary)] hover:underline"
                            >
                              Connect MCP
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={async () => {
                            const url = await connectIntegration(
                              provider,
                              getToken,
                              window.location.href,
                            );
                            if (url) window.location.href = url;
                          }}
                          className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline"
                        >
                          <Link2 className="w-2.5 h-2.5" />
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Settings className="w-3 h-3" />
                Full settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="border-t border-[var(--border)]/30 bg-transparent px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)]/40 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30 transition-colors"
          >
            <Layers className="w-3 h-3" />
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConnectPanel(!showConnectPanel);
              if (!showConnectPanel) void loadIntegrations();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)]/40 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/30 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            Connect
            {integrations.filter((i) => i.connected).length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center">
                {integrations.filter((i) => i.connected).length}
              </span>
            )}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              latestPlan
                ? 'Tell Vocaweb what to change in the plan...'
                : 'Describe what you want to build...'
            }
            rows={1}
            className="flex-1 resize-none bg-[var(--muted)]/50 border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all disabled:opacity-50 max-h-[120px]"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </form>
      </div>

      <ImportSourceModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={currentProject ?? undefined}
        onImported={({ plan }) => {
          setLatestPlan(plan);
          setBuildPlan(plan);
          setAgentMode('planning');
          addChatMessage({
            role: 'assistant',
            text: "Here's a build plan from your imported sources:",
            plan,
          });
        }}
      />
    </div>
  );
}
