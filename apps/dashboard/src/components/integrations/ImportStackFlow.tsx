'use client';

import { useState } from 'react';
import { Layers, Rocket } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useAppStore } from '@/store';
import { ImportSourceModal } from './ImportSourceModal';

export function ImportStackFlow({ projectId }: { projectId?: string }) {
  const { authenticated: isSignedIn } = usePrivy();
  const [open, setOpen] = useState(false);
  const setBuildPlan = useAppStore((s) => s.setBuildPlan);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const enterLiveBuild = useAppStore((s) => s.enterLiveBuild);
  const finishBuild = useAppStore((s) => s.finishBuild);
  const addChatMessage = useAppStore((s) => s.addChatMessage);

  if (!isSignedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)]/40 bg-[var(--card)]/10 hover:bg-[var(--muted)]/30 text-sm font-medium transition-colors"
      >
        <Layers className="w-4 h-4 text-[var(--primary)]" />
        Import Stack
      </button>

      <ImportSourceModal
        open={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
        buildImmediately
        onImported={({ plan, buildResult }) => {
          setBuildPlan(plan);
          setAgentMode('planning');
          addChatMessage({
            role: 'assistant',
            text: 'Imported your sources and generated a build plan.',
            plan,
          });

          if (buildResult) {
            enterLiveBuild();
            setCurrentProject(buildResult.projectId);
            setProjectFiles(buildResult.files);
            finishBuild();
            setAgentMode('sandbox');
            addChatMessage({
              role: 'assistant',
              text: 'Your site is ready from the import stack! Check the live preview.',
              filesGenerated: Object.keys(buildResult.files).length,
            });
          }
        }}
      />
    </>
  );
}

export function ImportStackBanner() {
  return (
    <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[var(--primary)]" />
          Build from your stack
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">
          Combine Notion copy, Canva assets, and Figma design tokens in one build.
        </p>
      </div>
      <ImportStackFlow />
    </div>
  );
}
