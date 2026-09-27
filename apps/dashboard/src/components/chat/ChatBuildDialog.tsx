'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Loader2,
  RotateCcw,
  Hammer,
  Rocket,
  Layers,
  Link2,
  Check,
  Settings,
  MessageSquareText,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Tag } from '@/components/ui/tag';
import { APP_SETTINGS } from '@/lib/routes';
import { ConversationMessage } from '@/components/shared/ConversationMessage';
import { useAuthSession } from '@/lib/auth';
import { useAppStore, useHydrated, type ChatMessage, type ModelTier } from '@/store';
import { apiFetch, describeApiError } from '@/lib/api';
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="overflow-hidden rounded-[10px] border-[1.5px] border-rule bg-paper text-ink shadow-hard"
    >
      <div className="flex items-center justify-between border-b-[1.5px] border-rule bg-wash px-4 py-2.5">
        <span className="vw-kicker text-ink">Build plan</span>
        <Tag tone="warn">Waiting for you</Tag>
      </div>
      <div className="chat-markdown px-4 py-3">
        <ReactMarkdown
          allowedElements={['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'br', 'h3', 'h4']}
          unwrapDisallowed
        >
          {plan}
        </ReactMarkdown>
      </div>
      <div className="flex items-center gap-2 border-t-[1.5px] border-dashed border-soft px-4 py-3 max-md:flex-col max-md:items-stretch">
        <Button variant="primary" size="sm" onClick={onConfirm} disabled={isLoading}>
          <Rocket className="h-3.5 w-3.5" aria-hidden />
          Build this
        </Button>
        <Button size="sm" onClick={onEdit} disabled={isLoading}>
          Change plan
        </Button>
      </div>
    </motion.div>
  );
}

export function ChatBuildDialog() {
  const hydrated = useHydrated();
  const { getToken, isSignedIn } = useAuthSession();
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
              // Full sentences from the server (such as the daily allowance) stand on their own.
              text: /[.!?]$/.test(message) ? message : `Something went wrong: ${message}`,
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
      currentProject,
      setDbChatSessionId,
      setAgentMode,
      setBuildPlan,
      selectedModel,
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
            }),
          },
          getToken,
        );

        const data = await res.json();

        if (data.error === 'access_denied' || data.error === 'limit_reached') {
          finishBuild();
          addChatMessage({
            role: 'assistant',
            text: describeApiError(data, 'That request could not be completed.'),
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
          addChatMessage({ role: 'assistant', text: 'Generating your image...' });
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
              addChatMessage({
                role: 'assistant',
                text: describeApiError(imgData, 'The image could not be generated.'),
              });
            }
          } catch {
            addChatMessage({ role: 'assistant', text: 'Failed to generate image. Please try again.' });
          }
          return;
        }

        if (data.error) {
          finishBuild();
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
      finishBuild,
      getToken,
      dbChatSessionId,
      setDbChatSessionId,
      linkActiveSessionToDb,
      currentProject,
      selectedModel,
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

  const modeLabel = isBuilding
    ? 'Building your site'
    : agentMode === 'planning'
      ? 'Reviewing the plan'
      : isLoading
        ? 'Thinking'
        : 'Ready when you are';

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="vw-card flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b-[1.5px] border-rule px-5 py-3.5 max-md:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-[1.5px] border-rule bg-ink text-paper">
            <Hammer className={isBuilding ? 'h-5 w-5 animate-pulse' : 'h-5 w-5'} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight">VocaWeb</h2>
            <p className="truncate font-mono text-[11.5px] text-dim" role="status">
              {modeLabel}
            </p>
          </div>
          <ModelSelector />
        </div>

        {chatHistory.length > 0 && (
          <Button size="sm" onClick={handleNewChat} disabled={isLoading} className="shrink-0">
            <RotateCcw className="h-3 w-3" aria-hidden />
            New chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 max-md:px-3">
        {chatHistory.length === 0 && !isLoading && (
          <div className="flex h-full items-center justify-center py-6">
            <EmptyState
              icon={<MessageSquareText className="h-6 w-6" aria-hidden />}
              title="Tell VocaWeb what to build"
              className="w-full max-w-[520px] border-0 bg-transparent"
            >
              Describe your website idea. You get a plan first, and the build starts once you
              approve it.
            </EmptyState>
          </div>
        )}

        {(chatHistory.length > 0 || isLoading) && (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {chatHistory.map((msg, i) => (
                <ConversationMessage key={`msg-${i}`} role={msg.role}>
                  {msg.role === 'assistant' ? (
                    <div className="chat-markdown">
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
                          className="w-full max-w-full rounded-lg border-[1.5px] border-rule"
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
                    <p className="mt-1.5 font-mono text-[10.5px] text-dim">
                      {msg.filesGenerated} files generated
                      {msg.skillsUsed?.length ? `, ${msg.skillsUsed.length} skills used` : ''}
                    </p>
                  )}
                </ConversationMessage>
              ))}
            </AnimatePresence>

            {isLoading && (
              <ConversationMessage role="assistant">
                <div className="flex items-center gap-2 text-dim">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>{isBuilding ? 'Building your website' : 'Thinking'}</span>
                </div>
              </ConversationMessage>
            )}
          </div>
        )}
      </div>

      {/* Connect panel */}
      <AnimatePresence>
        {showConnectPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t-[1.5px] border-dashed border-soft"
          >
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="vw-kicker">Connect integrations</p>
                <button
                  type="button"
                  onClick={() => setShowConnectPanel(false)}
                  className="text-xs font-semibold text-dim hover:text-ink"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                {(['notion', 'canva', 'figma'] as IntegrationProvider[]).map((provider) => {
                  const status = integrations.find((i) => i.provider === provider);
                  const connected = status?.connected ?? false;
                  const configured = status?.configured ?? false;
                  const mcpConnected = status?.mcpConnected ?? false;
                  const mcpConfigured = status?.mcpConfigured ?? false;

                  return (
                    <div key={provider} className="vw-card-soft space-y-2 p-3">
                      <p className="text-xs font-semibold capitalize">{provider}</p>
                      {!configured ? (
                        <p className="text-[11px] text-warn">Not configured</p>
                      ) : connected ? (
                        <div className="space-y-1">
                          <span className="flex items-center gap-1 text-[11px] text-ok">
                            <Check className="h-2.5 w-2.5" aria-hidden /> Connected
                          </span>
                          {mcpConfigured && (
                            <span
                              className={`flex items-center gap-1 text-[11px] ${
                                mcpConnected ? 'text-ok' : 'text-dim'
                              }`}
                            >
                              MCP {mcpConnected ? 'on' : provider === 'canva' ? '' : 'ready'}
                            </span>
                          )}
                          {provider === 'canva' && mcpConfigured && !mcpConnected && (
                            <button
                              type="button"
                              onClick={async () => {
                                const url = await connectCanvaMcp(
                                  getToken,
                                  window.location.href,
                                );
                                if (url) window.location.href = url;
                              }}
                              className="text-[11px] font-semibold text-brand hover:underline"
                            >
                              Connect MCP
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const url = await connectIntegration(
                              provider,
                              getToken,
                              window.location.href,
                            );
                            if (url) window.location.href = url;
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                        >
                          <Link2 className="h-2.5 w-2.5" aria-hidden />
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Link
                href={APP_SETTINGS}
                className="flex items-center gap-1 text-[11px] text-dim hover:text-ink"
              >
                <Settings className="h-3 w-3" aria-hidden />
                Full settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="space-y-2.5 border-t-[1.5px] border-rule px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            <Layers className="h-3 w-3" aria-hidden />
            Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showConnectPanel}
            onClick={() => {
              setShowConnectPanel(!showConnectPanel);
              if (!showConnectPanel) void loadIntegrations();
            }}
          >
            <Link2 className="h-3 w-3" aria-hidden />
            Connect
            {connectedCount > 0 && <Tag tone="ok">{connectedCount}</Tag>}
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              latestPlan
                ? 'Tell VocaWeb what to change in the plan'
                : 'Describe what you want to build'
            }
            rows={1}
            className="vw-input max-h-[120px] flex-1 resize-none py-3"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="!h-[46px] !w-[46px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-5 w-5" aria-hidden />
            )}
          </Button>
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
