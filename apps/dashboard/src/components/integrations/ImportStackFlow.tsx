'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/lib/auth';
import { useAppStore } from '@/store';
import { ImportSourceModal } from './ImportSourceModal';

export function ImportStackFlow({ projectId }: { projectId?: string }) {
  const { isSignedIn } = useAuthSession();
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
      <Button size="sm" onClick={() => setOpen(true)} className="shrink-0">
        <Layers className="h-4 w-4" aria-hidden />
        Import sources
      </Button>

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
              text: 'Your site is built from the imported sources. Check the live preview.',
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
    <div className="vw-card-soft flex flex-col justify-between gap-3 border-dashed p-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold">Build from what you already have</p>
        <p className="mt-1 text-[13px] text-dim">
          Combine Notion copy, Canva assets and Figma design tokens in one build.
        </p>
      </div>
      <ImportStackFlow />
    </div>
  );
}
