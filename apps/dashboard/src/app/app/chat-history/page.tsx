'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  MessageSquare,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Mic,
  MessageCircle,
  FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth';
import { useAppStore, useHydrated, type ChatSession } from '@/store';
import {
  fetchChatSession,
  mapDbMessagesToChat,
  ensureSessionMessages,
  loadProjectFilesForSession,
  deleteChatSessionOnServer,
  deleteVoiceSessionOnServer,
  isDbSessionId,
} from '@/lib/conversations';
import { ConversationMessage } from '@/components/shared/ConversationMessage';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Tag } from '@/components/ui/tag';
import { APP_HOME } from '@/lib/routes';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function ListSkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Loading conversations">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="vw-card-soft flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionDetail({
  session,
  onBack,
  onDelete,
  onContinue,
  loadingMessages,
  continuing,
}: {
  session: ChatSession;
  onBack: () => void;
  onDelete: (id: string) => void;
  onContinue: () => void;
  loadingMessages: boolean;
  continuing: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All conversations
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onContinue}
            disabled={loadingMessages}
            loading={continuing}
            className="max-md:flex-1"
          >
            {!continuing && <MessageCircle className="h-4 w-4" aria-hidden />}
            Continue
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(session.id)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <h1 className="text-[26px] font-semibold leading-tight">{session.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-dim">
          <span>{formatDate(session.createdAt)}</span>
          <Tag>{session.messages.length} messages</Tag>
          {session.source === 'voice' && (
            <Tag tone="brand">
              <Mic className="h-3 w-3" aria-hidden />
              Voice
            </Tag>
          )}
          {session.projectId && (
            <Tag>
              <FolderOpen className="h-3 w-3" aria-hidden />
              Linked project
            </Tag>
          )}
        </div>
      </div>

      <div className="vw-card overflow-hidden">
        {loadingMessages ? (
          <div className="grid gap-4 p-6" aria-busy="true">
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-12 w-2/5" />
          </div>
        ) : session.messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-dim">
            There are no messages in this conversation.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5">
            {session.messages.map((msg, i) => (
              <div key={i}>
                <ConversationMessage role={msg.role}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.images.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt="Generated by VocaWeb"
                          className="max-h-96 max-w-full rounded-lg border-[1.5px] border-rule object-cover"
                        />
                      ))}
                    </div>
                  )}
                </ConversationMessage>
                {msg.filesGenerated && msg.filesGenerated > 0 && (
                  <p className="mt-1.5 font-mono text-[10.5px] text-dim">
                    {msg.filesGenerated} files generated
                    {msg.skillsUsed?.length ? `, ${msg.skillsUsed.length} skills used` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ChatHistoryPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const chatSessions = useAppStore((s) => s.chatSessions);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const clearAllSessions = useAppStore((s) => s.clearAllSessions);
  const updateSessionMessages = useAppStore((s) => s.updateSessionMessages);
  const resumeSession = useAppStore((s) => s.resumeSession);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const hydrated = useHydrated();
  const { getToken, isSignedIn } = useAuthSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingClear]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      setSelectedId(id);

      const session = useAppStore.getState().chatSessions.find((s) => s.id === id);
      if (!session || session.messages.length > 0 || session.source !== 'chat' || !isSignedIn) {
        return;
      }

      setLoadingMessages(true);
      try {
        const data = await fetchChatSession(id, getToken);
        if (data?.messages) {
          const messages = mapDbMessagesToChat(data.messages);
          updateSessionMessages(id, messages);
        }
      } catch {
        /* the empty state explains itself */
      } finally {
        setLoadingMessages(false);
      }
    },
    [getToken, isSignedIn, updateSessionMessages],
  );

  const handleContinueSession = useCallback(
    async (session: ChatSession) => {
      setContinuing(true);
      try {
        let fullSession = session;
        if (isSignedIn && session.source === 'chat' && session.messages.length === 0) {
          fullSession = await ensureSessionMessages(session, getToken);
          updateSessionMessages(fullSession.id, fullSession.messages);
        }

        resumeSession(fullSession);

        if (fullSession.projectId && isSignedIn) {
          const files = await loadProjectFilesForSession(fullSession.projectId, getToken);
          if (files) setProjectFiles(files);
        }

        router.push(APP_HOME);
      } finally {
        setContinuing(false);
      }
    },
    [getToken, isSignedIn, resumeSession, router, setProjectFiles, updateSessionMessages],
  );

  const selectedSession = selectedId
    ? (chatSessions.find((s) => s.id === selectedId) ?? null)
    : null;

  const handleDelete = (id: string) => {
    if (isSignedIn) {
      if (id.startsWith('voice-')) {
        void deleteVoiceSessionOnServer(id.replace(/^voice-/, ''), getToken);
      } else if (isDbSessionId(id)) {
        void deleteChatSessionOnServer(id, getToken);
      }
    }
    deleteSession(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="mx-auto w-full max-w-[960px] pb-12">
      <AnimatePresence mode="wait">
        {selectedSession ? (
          <SessionDetail
            key={selectedSession.id}
            session={selectedSession}
            onBack={() => setSelectedId(null)}
            onDelete={handleDelete}
            onContinue={() => void handleContinueSession(selectedSession)}
            loadingMessages={loadingMessages}
            continuing={continuing}
          />
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-7 flex items-end justify-between gap-4 max-md:flex-col max-md:items-stretch">
              <div>
                <h1 className="text-[clamp(30px,4vw,42px)] font-semibold leading-[1.05] tracking-[-0.035em]">
                  History
                </h1>
                <p className="mt-2 text-[15.5px] text-dim">
                  Every chat and voice session, ready to pick up again.
                </p>
              </div>
              {chatSessions.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (confirmingClear) {
                      clearAllSessions();
                      setConfirmingClear(false);
                    } else {
                      setConfirmingClear(true);
                    }
                  }}
                  className={confirmingClear ? '!border-bad !text-bad' : undefined}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {confirmingClear ? 'Press again to clear' : 'Clear all'}
                </Button>
              )}
            </div>

            {!hydrated ? (
              <ListSkeleton />
            ) : chatSessions.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-6 w-6" aria-hidden />}
                title="No conversations yet"
              >
                Start a build in chat or voice and it will be saved here.
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {chatSessions.map((session, i) => {
                  const lastMsg = session.messages[session.messages.length - 1];
                  const preview = lastMsg
                    ? lastMsg.text.length > 80
                      ? `${lastMsg.text.slice(0, 80)}...`
                      : lastMsg.text
                    : session.source === 'chat'
                      ? 'Open to load the messages'
                      : '';
                  const SourceIcon = session.source === 'voice' ? Mic : MessageSquare;

                  return (
                    <motion.li
                      key={session.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03 }}
                    >
                      <button
                        type="button"
                        onClick={() => void handleSelectSession(session.id)}
                        className="group flex w-full items-center gap-4 rounded-[10px] border-[1.5px] border-soft bg-paper p-4 text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-x-px hover:-translate-y-px hover:border-rule hover:shadow-hard"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-[1.5px] border-rule bg-wash">
                          <SourceIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-display text-[15px] font-semibold">
                              {session.title}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-dim">
                              {formatDate(session.createdAt)}
                            </span>
                          </span>
                          {preview && (
                            <span className="mt-0.5 block truncate text-[13px] text-dim">
                              {preview}
                            </span>
                          )}
                          <span className="mt-1.5 flex items-center gap-1.5">
                            <Tag>
                              {session.messages.length > 0
                                ? `${session.messages.length} messages`
                                : session.source === 'voice'
                                  ? 'Voice session'
                                  : 'Text chat'}
                            </Tag>
                            {session.projectId && (
                              <Tag>
                                <FolderOpen className="h-2.5 w-2.5" aria-hidden />
                                Project
                              </Tag>
                            )}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-dim transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-ink"
                          aria-hidden
                        />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
