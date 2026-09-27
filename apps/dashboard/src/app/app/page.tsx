'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Mic, Type } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, useHydrated } from '@/store';
import { useVoice } from '@/components/voice/VoiceProvider';
import { prewarmWebContainer } from '@/hooks/useWebContainer';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { Segmented, Skeleton } from '@/components/ui/feedback';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

/** Matches the dialog's frame so nothing jumps when it arrives. */
function DialogLoader() {
  return (
    <div className="vw-card flex min-h-[420px] flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="grid gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="mt-4 h-12 w-2/3" />
      <Skeleton className="ml-auto h-12 w-1/2" />
      <Skeleton className="mt-auto h-12 w-full" />
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

const FILL = 'flex min-h-[calc(100dvh-60px-4rem)] flex-1 flex-col';

export default function AppHomePage() {
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
    // v1 sites are plain HTML and preview without the sandbox runtime.
    if (!didPrewarm.current && useAppStore.getState().selectedModel !== 'v1') {
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
          console.error('[VocaWeb] Auto-start voice failed:', err);
        }
      })();
    }
  }, [autoStartVoice, isConnected, connect, setAutoStartVoice, setAgentMode, setDashboardMode]);

  if (!hydrated) {
    return (
      <div className={FILL}>
        <DialogLoader />
      </div>
    );
  }

  if (agentMode === 'sandbox') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`relative ${FILL}`}
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
    <div className={`relative gap-4 ${FILL}`}>
      <div className="flex justify-end">
        <Segmented
          label="Input mode"
          value={dashboardMode}
          onChange={setDashboardMode}
          options={[
            { value: 'text', label: 'Chat', icon: <Type className="h-3.5 w-3.5" aria-hidden /> },
            { value: 'voice', label: 'Voice', icon: <Mic className="h-3.5 w-3.5" aria-hidden /> },
          ]}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={dashboardMode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <BuildInterface />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
