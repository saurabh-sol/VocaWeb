'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  User,
  Trash2,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Clock,
  Mic,
  MessageCircle,
  FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
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
      <div className="flex items-center justify-between mb-6 gap-3 max-md:flex-col max-md:items-stretch">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All Chats
        </button>
        <div className="flex items-center gap-2 max-md:w-full">
          <button
            onClick={onContinue}
            disabled={continuing || loadingMessages}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 max-md:flex-1 max-md:justify-center"
          >
            {continuing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            Continue Chat
          </button>
          <button
            onClick={() => onDelete(session.id)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted-foreground)] hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{session.title}</h2>
          {session.source === 'voice' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <Mic className="w-3 h-3" />
              Voice
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1 flex items-center gap-1.5 flex-wrap">
          <Clock className="w-3 h-3" />
          {formatDate(session.createdAt)} &middot; {session.messages.length} messages
          {session.projectId && (
            <>
              <span>&middot;</span>
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                Linked project
              </span>
            </>
          )}
        </p>
      </div>

      <div className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl overflow-hidden shadow-xl">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : session.messages.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">
            No messages in this session.
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {session.messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start gap-3"
              >
                <div
                  className={`p-2.5 rounded-full shrink-0 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]'
                  }`}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
                    {msg.role === 'user' ? 'You' : 'Vocaweb'}
                  </p>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-tl-sm'
                        : 'bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.images.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt="Generated by Vocaweb"
                          className="rounded-xl max-w-full max-h-96 object-cover border border-[var(--border)]/30"
                        />
                      ))}
                    </div>
                  )}
                  {msg.filesGenerated && msg.filesGenerated > 0 && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5 ml-1">
                      {msg.filesGenerated} files generated
                      {msg.skillsUsed?.length ? ` · ${msg.skillsUsed.length} skills used` : ''}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ChatHistoryPage() {
  const router = useRouter();
  const chatSessions = useAppStore((s) => s.chatSessions);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const clearAllSessions = useAppStore((s) => s.clearAllSessions);
  const updateSessionMessages = useAppStore((s) => s.updateSessionMessages);
  const resumeSession = useAppStore((s) => s.resumeSession);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const hydrated = useHydrated();
  const { getAccessToken, authenticated: isSignedIn } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setLoading(false);
  }, [hydrated, isSignedIn]);

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
        /* show empty state */
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

        router.push('/');
      } finally {
        setContinuing(false);
      }
    },
    [
      getToken,
      isSignedIn,
      resumeSession,
      router,
      setProjectFiles,
      updateSessionMessages,
    ],
  );

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  const selectedSession = selectedId
    ? chatSessions.find((s) => s.id === selectedId) ?? null
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex justify-between items-end mb-6 max-md:flex-col max-md:items-stretch max-md:gap-4">
              <div>
                <h1 className="text-3xl font-bold font-serif tracking-tight max-md:text-2xl">Chats</h1>
                <p className="text-[var(--muted-foreground)] mt-2 max-md:text-sm max-md:mt-1">
                  Your conversations with Vocaweb.
                </p>
              </div>
              {chatSessions.length > 0 && (
                <button
                  onClick={clearAllSessions}
                  className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-red-400 bg-[var(--card)]/10 border border-[var(--border)]/30 px-4 py-2 rounded-full shadow-sm transition-colors backdrop-blur-md max-md:w-full max-md:justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--muted-foreground)]" />
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-12 text-center shadow-xl">
                <div className="h-16 w-16 rounded-full bg-[var(--muted)]/30 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-7 w-7 text-[var(--muted-foreground)]" />
                </div>
                <p className="text-lg font-medium text-[var(--foreground)] mb-1">
                  No chats yet
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Start a conversation with Vocaweb to see your chats here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatSessions.map((session, i) => {
                  const lastMsg = session.messages[session.messages.length - 1];
                  const preview = lastMsg
                    ? lastMsg.text.length > 80
                      ? lastMsg.text.slice(0, 80) + '...'
                      : lastMsg.text
                    : session.source === 'chat'
                      ? 'Tap to load messages'
                      : '';

                  return (
                    <motion.button
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleSelectSession(session.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md hover:bg-[var(--muted)]/30 transition-all text-left group"
                    >
                      <div className="h-10 w-10 rounded-full bg-[var(--muted)]/30 flex items-center justify-center shrink-0">
                        {session.source === 'voice' ? (
                          <Mic className="w-4.5 h-4.5 text-[var(--muted-foreground)]" />
                        ) : (
                          <MessageSquare className="w-4.5 h-4.5 text-[var(--muted-foreground)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                            {session.title}
                          </h3>
                          <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                            {formatDate(session.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                          {preview}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] mt-1 flex items-center gap-2">
                          <span>
                            {session.messages.length > 0
                              ? `${session.messages.length} messages`
                              : session.source === 'voice'
                                ? 'Voice session'
                                : 'Text chat'}
                          </span>
                          {session.projectId && (
                            <span className="inline-flex items-center gap-0.5">
                              <FolderOpen className="w-2.5 h-2.5" />
                              Project
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
