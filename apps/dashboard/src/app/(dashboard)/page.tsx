'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Type, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useHydrated } from '@/store';
import { useVoice } from '@/components/voice/VoiceProvider';
import { prewarmWebContainer } from '@/hooks/useWebContainer';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

function DialogLoader() {
  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <div className="h-6 w-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
    </div>
  );
}

const VoiceBuildDialog = dynamic(
  lazyWithRetry(() =>
    import('@/components/voice/VoiceBuildDialog').then((m) => m.VoiceBuildDialog),
  ),
  { ssr: false, loading: DialogLoader },
);

const ChatBuildDialog = dynamic(
  lazyWithRetry(() =>
    import('@/components/chat/ChatBuildDialog').then((m) => m.ChatBuildDialog),
  ),
  { ssr: false, loading: DialogLoader },
);

const SandboxLayout = dynamic(
  lazyWithRetry(() =>
    import('@/components/sandbox/SandboxLayout').then((m) => m.SandboxLayout),
  ),
  { ssr: false, loading: DialogLoader },
);

export default function DashboardPage() {
  const hydrated = useHydrated();
  const agentMode = useAppStore((s) => s.agentMode);
  const dashboardMode = useAppStore((s) => s.dashboardMode);
  const setDashboardMode = useAppStore((s) => s.setDashboardMode);
  const autoStartVoice = useAppStore((s) => s.autoStartVoice);
  const setAutoStartVoice = useAppStore((s) => s.setAutoStartVoice);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const { isConnected, connect } = useVoice();
  const didAutoStart = useRef(false);
  const didPrewarm = useRef(false);

  useEffect(() => {
    if (!didPrewarm.current) {
      didPrewarm.current = true;
      void prewarmWebContainer();
    }
  }, []);

  useEffect(() => {
    if (autoStartVoice && !didAutoStart.current) {
      didAutoStart.current = true;
      setAutoStartVoice(false);
      setAgentMode('chat');
      setDashboardMode('voice');

      (async () => {
        try {
          if (!isConnected) {
            await connect();
          }
        } catch (err) {
          console.error('[Vocaweb] Auto-start voice failed:', err);
        }
      })();
    }
  }, [autoStartVoice, isConnected, connect, setAutoStartVoice, setAgentMode, setDashboardMode]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="h-6 w-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (agentMode === 'sandbox') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative flex h-full min-h-[calc(100vh-4rem)] flex-col max-md:min-h-[calc(100dvh-5rem)]"
      >
        <SandboxLayout />
      </motion.div>
    );
  }

  if (agentMode === 'projects') {
    return <ProjectsView />;
  }

  const BuildInterface = dashboardMode === 'voice' ? VoiceBuildDialog : ChatBuildDialog;

  return (
    <div className="relative flex h-full min-h-[calc(100vh-4rem)] flex-col gap-4 max-md:min-h-[calc(100dvh-5rem)] max-md:gap-3">
      <div className="flex justify-end">
        <div className="flex bg-[var(--card)]/10 backdrop-blur-md rounded-full p-1 border border-[var(--border)]/30 shadow-sm w-fit">
          <button
            onClick={() => setDashboardMode('text')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              dashboardMode === 'text'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setDashboardMode('voice')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              dashboardMode === 'voice'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Voice
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={dashboardMode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          <BuildInterface />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
