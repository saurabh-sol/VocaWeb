'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, Code2, Loader2, MessageSquare, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store';
import { apiFetch } from '@/lib/api';
import { ensureSessionMessages, loadProjectFilesForSession } from '@/lib/conversations';
import { ImportStackBanner } from '@/components/integrations/ImportStackFlow';
import { AnimatePresence } from 'framer-motion';

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
  const { getAccessToken, authenticated: isSignedIn } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
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
    try {
      const res = await apiFetch('/projects', {}, getToken);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch {
      setProjects([]);
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
    setShowNewProjectModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) return;

    setIsCreating(true);
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
      }
    } catch (err) {
      console.error('Failed to create project:', err);
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
      router.push('/');
      return;
    }

    clearChat();
    setDbChatSessionId(null);
    setCurrentProject(projectId);
    const files = await loadProjectFilesForSession(projectId, getToken);
    if (files) setProjectFiles(files);
    setAgentMode('chat');
    setDashboardMode('text');
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 max-md:space-y-6">
      <ImportStackBanner />
      <div className="flex items-center justify-between max-md:flex-col max-md:items-stretch max-md:gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif tracking-tight max-md:text-2xl">Projects</h1>
          <p className="text-[var(--muted-foreground)] mt-2 max-md:text-sm max-md:mt-1">
            Your websites live here. Open the sandbox to preview and edit.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={startNewProject}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold shadow-md max-md:w-full max-md:justify-center"
        >
          <Plus className="w-4 h-4" />
          New Project
        </motion.button>
      </div>

      {isBuilding && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 max-md:flex-col max-md:items-stretch">
          <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin shrink-0 max-md:hidden" />
          <div className="flex items-center gap-3 min-w-0">
            <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin shrink-0 hidden max-md:block" />
            <p className="text-sm text-[var(--foreground)]">
              Vocaweb is building your site… Open <strong>Sandbox</strong> in the sidebar to watch the live preview.
            </p>
          </div>
        </div>
      )}

      {currentProject && !isBuilding && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 max-md:flex-col max-md:gap-3 max-md:items-stretch">
          <p className="text-sm text-[var(--muted-foreground)]">
            Latest build ready — open Sandbox to preview.
          </p>
          <button
            onClick={() => setAgentMode('sandbox')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 max-md:w-full max-md:justify-center"
          >
            <Code2 className="w-3.5 h-3.5" />
            Open Sandbox
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-[var(--primary)] animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)]/40">
          <FolderOpen className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
          <p className="text-[var(--muted-foreground)] mb-4">No projects yet.</p>
          <button
            onClick={startNewProject}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create your first site
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 w-full px-4 sm:px-5 py-4 rounded-xl border border-[var(--border)]/30 bg-[var(--card)]/10 hover:bg-[var(--card)]/20 transition-colors"
            >
              <motion.button
                whileHover={{ scale: 1.005 }}
                onClick={() => void openProjectInSandbox(p.id)}
                className="flex items-center justify-between flex-1 min-w-0 text-left gap-3"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">{p.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {p.framework} · {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Code2 className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
              </motion.button>
              <button
                type="button"
                onClick={() => void openProjectChat(p.id)}
                title="Continue project chat"
                className="shrink-0 p-2.5 rounded-lg border border-[var(--border)]/30 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !isCreating && setShowNewProjectModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md rounded-2xl border border-[var(--border)]/30 bg-[var(--card)] p-6 shadow-xl"
            >
              <button
                onClick={() => setShowNewProjectModal(false)}
                disabled={isCreating}
                className="absolute top-4 right-4 p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold font-serif text-[var(--foreground)] mb-1">
                Name your project
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] mb-6">
                Give your new website a name. You can change this later.
              </p>

              <form onSubmit={handleCreateProject}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      Project Name
                    </label>
                    <input
                      id="projectName"
                      type="text"
                      autoFocus
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. My Portfolio, Coffee Shop"
                      disabled={isCreating}
                      className="w-full bg-[var(--muted)]/50 border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all disabled:opacity-50"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewProjectModal(false)}
                      disabled={isCreating}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create & Start Chat'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
