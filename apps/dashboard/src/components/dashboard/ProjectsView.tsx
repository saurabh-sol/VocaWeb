'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, FolderOpen, Code2, Loader2, MessageSquare, ArrowUpRight } from 'lucide-react';
import { useAuthSession } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { apiFetch } from '@/lib/api';
import { ensureSessionMessages, loadProjectFilesForSession } from '@/lib/conversations';
import { ImportStackBanner } from '@/components/integrations/ImportStackFlow';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Notice, Tag } from '@/components/ui/tag';
import { APP_HOME } from '@/lib/routes';

interface ProjectRow {
  id: string;
  name: string;
  framework: string;
  status: string;
  updated_at: string;
  custom_domain?: string | null;
}

export function ProjectsView() {
  const router = useRouter();
  const { getToken, isSignedIn, user } = useAuthSession();
  const reduce = useReducedMotion();
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const setDashboardMode = useAppStore((s) => s.setDashboardMode);
  const clearChat = useAppStore((s) => s.clearChat);
  const setDbChatSessionId = useAppStore((s) => s.setDbChatSessionId);
  const chatSessions = useAppStore((s) => s.chatSessions);
  const resumeSession = useAppStore((s) => s.resumeSession);
  const updateSessionMessages = useAppStore((s) => s.updateSessionMessages);
  const isBuilding = useAppStore((s) => s.isBuilding);
  const currentProject = useAppStore((s) => s.currentProject);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!isSignedIn) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch('/projects', {}, getToken);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      } else {
        setLoadError('Your projects could not be loaded. Try again in a moment.');
      }
    } catch {
      setProjects([]);
      setLoadError('Could not reach the server. Check that the API is running.');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const openProjectInSandbox = async (projectId: string) => {
    try {
      const res = await apiFetch(`/projects/${projectId}`, {}, getToken);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentProject(projectId);
      setProjectFiles(data.files ?? {});
      setAgentMode('sandbox');
    } catch {
      /* ignore */
    }
  };

  const startNewProject = () => {
    setNewProjectName('');
    setCreateError(null);
    setShowNewProjectModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await apiFetch(
        '/projects',
        {
          method: 'POST',
          body: JSON.stringify({ name: newProjectName.trim() || 'Untitled Project' }),
        },
        getToken,
      );

      if (res.ok) {
        const data = await res.json();
        clearChat();
        setDbChatSessionId(null);
        setCurrentProject(data.project.id);
        setProjectFiles({});
        setAgentMode('chat');
        setDashboardMode('text');
        setShowNewProjectModal(false);
      } else {
        setCreateError('The project could not be created. Try again.');
      }
    } catch {
      setCreateError('Could not reach the server. Check that the API is running.');
    } finally {
      setIsCreating(false);
    }
  };

  const openProjectChat = async (projectId: string) => {
    const linked = chatSessions.find(
      (s) => s.projectId === projectId && (s.source === 'chat' || s.source === 'voice'),
    );

    if (linked && isSignedIn) {
      let fullSession = linked;
      if (linked.source === 'chat' && linked.messages.length === 0) {
        fullSession = await ensureSessionMessages(linked, getToken);
        updateSessionMessages(fullSession.id, fullSession.messages);
      }
      resumeSession(fullSession);
      const files = await loadProjectFilesForSession(projectId, getToken);
      if (files) setProjectFiles(files);
      router.push(APP_HOME);
      return;
    }

    clearChat();
    setDbChatSessionId(null);
    setCurrentProject(projectId);
    const files = await loadProjectFilesForSession(projectId, getToken);
    if (files) setProjectFiles(files);
    setAgentMode('chat');
    setDashboardMode('text');
    router.push(APP_HOME);
  };

  const firstName = user?.name.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-7">
      <div className="flex items-end justify-between gap-4 max-md:flex-col max-md:items-stretch">
        <div>
          <h1 className="text-[clamp(30px,4vw,42px)] font-semibold leading-[1.05] tracking-[-0.035em]">
            {firstName ? `Hello, ${firstName}` : 'Projects'}
          </h1>
          <p className="mt-2 text-[15.5px] text-dim">
            Your websites live here. Open one to preview it, edit it or publish it.
          </p>
        </div>
        <Button variant="primary" onClick={startNewProject} className="max-md:w-full">
          <Plus className="h-4 w-4" aria-hidden />
          New project
        </Button>
      </div>

      <ImportStackBanner />

      {isBuilding && (
        <Notice role="status" className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          VocaWeb is building your site. Open the Sandbox to watch the live preview.
        </Notice>
      )}

      {currentProject && !isBuilding && (
        <Notice
          tone="ok"
          className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch"
        >
          <span>Your latest build is ready.</span>
          <Button size="sm" onClick={() => setAgentMode('sandbox')}>
            <Code2 className="h-3.5 w-3.5" aria-hidden />
            Open the sandbox
          </Button>
        </Notice>
      )}

      {loadError && (
        <Notice
          tone="bad"
          role="alert"
          className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch"
        >
          <span>{loadError}</span>
          <Button size="sm" onClick={() => void loadProjects()}>
            Retry
          </Button>
        </Notice>
      )}

      {loading ? (
        <div className="grid gap-3" aria-busy="true" aria-label="Loading projects">
          {[0, 1, 2].map((row) => (
            <div key={row} className="vw-card-soft flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 && !loadError ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" aria-hidden />}
          title="No projects yet"
          action={
            <Button variant="primary" onClick={startNewProject}>
              <Plus className="h-4 w-4" aria-hidden />
              Create your first site
            </Button>
          }
        >
          Name a project, describe the site you want and VocaWeb takes it from there.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {projects.map((p, index) => (
            <motion.li
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="group flex items-center gap-2 rounded-[10px] border-[1.5px] border-soft bg-paper pr-3 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-x-px hover:-translate-y-px hover:border-rule hover:shadow-hard"
            >
              <button
                type="button"
                onClick={() => void openProjectInSandbox(p.id)}
                className="flex min-w-0 flex-1 items-center gap-4 rounded-[10px] px-5 py-4 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-[1.5px] border-rule bg-wash font-display text-[15px] font-semibold uppercase">
                  {p.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[16px] font-semibold">
                    {p.name}
                  </span>
                  <span className="mt-1 flex items-center gap-2 font-mono text-[11.5px] text-dim">
                    <Tag>{p.framework}</Tag>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-dim transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                  aria-hidden
                />
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void openProjectChat(p.id)}
                aria-label={`Continue the chat for ${p.name}`}
                title="Continue the chat"
                className="shrink-0"
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
              </Button>
            </motion.li>
          ))}
        </ul>
      )}

      <Modal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        locked={isCreating}
        title="Name your project"
        description="You can change the name later."
      >
        <form onSubmit={handleCreateProject} className="grid gap-5">
          <Field label="Project name" htmlFor="projectName" error={createError}>
            <Input
              id="projectName"
              type="text"
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="My portfolio"
              disabled={isCreating}
              maxLength={80}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowNewProjectModal(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isCreating}>
              {isCreating ? 'Creating' : 'Create and start'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
