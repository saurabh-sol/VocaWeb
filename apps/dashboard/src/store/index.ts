import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useEffect, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  filesGenerated?: number;
  skillsUsed?: string[];
  plan?: string;
  images?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
  source?: 'chat' | 'voice' | 'local';
  projectId?: string | null;
}

export interface VoiceResumePayload {
  sessionId: string;
  transcript: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export type AgentMode = 'projects' | 'chat' | 'planning' | 'sandbox';
export type PublishStatus = 'idle' | 'publishing' | 'published' | 'error';
export type ModelTier = 'v1' | 'v2' | 'v3';

export const MODEL_TIERS = {
  v1: { label: 'Vocaweb v1', tag: 'base', free: true, tokensRequired: 0 },
  v2: { label: 'Vocaweb v2', tag: 'pro', free: false, tokensRequired: 250_000 },
  v3: { label: 'Vocaweb v3', tag: 'max', free: false, tokensRequired: 1_000_000 },
} as const;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.text.trim();
  return text.length > 50 ? text.slice(0, 50) + '...' : text;
}

import { SCAFFOLD_FILES, getScaffoldForTier } from '@/lib/scaffold-template';

interface AppState {
  _hasHydrated: boolean;
  isVoiceActive: boolean;
  currentProject: string | null;
  autoStartVoice: boolean;
  dashboardMode: 'text' | 'voice';
  initialPrompt: string | null;
  chatHistory: ChatMessage[];
  username: string | null;
  selectedModel: ModelTier;
  v1TrialsUsed: number;

  chatSessions: ChatSession[];
  activeSessionId: string | null;

  agentMode: AgentMode;
  isBuilding: boolean;
  projectFiles: Record<string, string>;
  activeFile: string | null;
  buildPlan: string | null;
  sandboxViewMode: 'code' | 'preview';
  sandboxSidebarOpen: boolean;
  fileVersion: number;
  dbChatSessionId: string | null;
  voiceDbSessionId: string | null;
  voiceResume: VoiceResumePayload | null;

  publishStatus: PublishStatus;
  publishUrl: string | null;
  publishDomain: string | null;
  publishDeploymentId: string | null;
  publishError: string | null;

  setUsername: (name: string | null) => void;
  setSelectedModel: (model: ModelTier) => void;
  incrementTrialUsed: () => void;
  setHasHydrated: (v: boolean) => void;
  setVoiceActive: (active: boolean) => void;
  setCurrentProject: (id: string | null) => void;
  setAutoStartVoice: (auto: boolean) => void;
  setDashboardMode: (mode: 'text' | 'voice') => void;
  setInitialPrompt: (prompt: string | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  saveCurrentSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  hydrateChatSessionsFromServer: (sessions: ChatSession[]) => void;
  updateSessionMessages: (id: string, messages: ChatMessage[]) => void;
  resumeSession: (session: ChatSession) => void;
  linkActiveSessionToDb: (dbSessionId: string) => void;
  clearVoiceResume: () => void;

  setAgentMode: (mode: AgentMode) => void;
  setProjectFiles: (files: Record<string, string>) => void;
  mergeProjectFiles: (files: Record<string, string>) => void;
  setActiveFile: (path: string | null) => void;
  setBuildPlan: (plan: string | null) => void;
  setSandboxViewMode: (mode: 'code' | 'preview') => void;
  setSandboxSidebarOpen: (open: boolean) => void;
  incrementFileVersion: () => void;
  setDbChatSessionId: (id: string | null) => void;
  setVoiceDbSessionId: (id: string | null) => void;
  setActiveSessionFromDb: (dbSessionId: string) => void;
  applyBulkSessionMappings: (mappings: Array<{ localId: string; dbSessionId: string }>) => void;
  setPublishState: (state: Partial<Pick<AppState, 'publishStatus' | 'publishUrl' | 'publishDomain' | 'publishDeploymentId' | 'publishError'>>) => void;
  clearPublishState: () => void;
  enterLiveBuild: () => void;
  finishBuild: () => void;
  resetProject: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      isVoiceActive: false,
      currentProject: null,
      autoStartVoice: false,
      dashboardMode: 'text',
      initialPrompt: null,
      chatHistory: [],
      username: null,
      selectedModel: 'v1',
      v1TrialsUsed: 0,

      chatSessions: [],
      activeSessionId: null,

      agentMode: 'projects',
      isBuilding: false,
      projectFiles: {},
      activeFile: null,
      buildPlan: null,
      sandboxViewMode: 'preview',
      sandboxSidebarOpen: false,
      fileVersion: 0,
      dbChatSessionId: null,
      voiceDbSessionId: null,
      voiceResume: null,

      publishStatus: 'idle',
      publishUrl: null,
      publishDomain: null,
      publishDeploymentId: null,
      publishError: null,

      setUsername: (name) => set({ username: name }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      incrementTrialUsed: () => set((s) => ({ v1TrialsUsed: s.v1TrialsUsed + 1 })),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setVoiceActive: (active) => set({ isVoiceActive: active }),
      setCurrentProject: (id) => set((s) => {
        const isNewProject = id !== s.currentProject;
        return {
          currentProject: id,
          ...(isNewProject ? {
            publishStatus: 'idle' as PublishStatus,
            publishUrl: null,
            publishDomain: null,
            publishDeploymentId: null,
            publishError: null,
          } : {}),
        };
      }),
      setAutoStartVoice: (auto) => set({ autoStartVoice: auto }),
      setDashboardMode: (mode) => set({ dashboardMode: mode }),
      setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),

      addChatMessage: (msg) => {
        const state = get();
        const updated = [...state.chatHistory, msg];

        if (state.activeSessionId) {
          const sessions = state.chatSessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, messages: updated, title: deriveTitle(updated) }
              : s,
          );
          set({ chatHistory: updated, chatSessions: sessions });
        } else {
          const newId = generateId();
          const session: ChatSession = {
            id: newId,
            title: deriveTitle(updated),
            createdAt: new Date().toISOString(),
            messages: updated,
            source: 'local',
          };
          set({
            chatHistory: updated,
            activeSessionId: newId,
            chatSessions: [session, ...state.chatSessions],
          });
        }
      },

      clearChat: () => set({ chatHistory: [], initialPrompt: null, activeSessionId: null }),

      saveCurrentSession: () => {
        const state = get();
        if (state.chatHistory.length === 0) return;
        if (state.activeSessionId) {
          const sessions = state.chatSessions.map((s) =>
            s.id === state.activeSessionId
              ? { ...s, messages: state.chatHistory, title: deriveTitle(state.chatHistory) }
              : s,
          );
          set({ chatSessions: sessions });
        }
      },

      loadSession: (id) => {
        const state = get();
        const session = state.chatSessions.find((s) => s.id === id);
        if (session) {
          set({ chatHistory: session.messages, activeSessionId: id });
        }
      },

      deleteSession: (id) => {
        const state = get();
        const sessions = state.chatSessions.filter((s) => s.id !== id);
        if (state.activeSessionId === id) {
          set({ chatSessions: sessions, chatHistory: [], activeSessionId: null });
        } else {
          set({ chatSessions: sessions });
        }
      },

      clearAllSessions: () => set({ chatSessions: [], chatHistory: [], activeSessionId: null }),

      hydrateChatSessionsFromServer: (serverSessions) =>
        set((state) => {
          const serverIds = new Set(serverSessions.map((s) => s.id));
          const localOnly = state.chatSessions.filter(
            (s) => !serverIds.has(s.id) && s.source === 'local',
          );
          const merged = [...serverSessions, ...localOnly].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          return { chatSessions: merged };
        }),

      updateSessionMessages: (id, messages) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((s) =>
            s.id === id
              ? { ...s, messages, title: deriveTitle(messages) || s.title }
              : s,
          ),
        })),

      resumeSession: (session) => {
        const lastPlan = [...session.messages].reverse().find((m) => m.plan)?.plan ?? null;
        const isVoice = session.source === 'voice';
        const dbChatId = session.source === 'chat' ? session.id : null;
        const voiceDbId = isVoice ? session.id.replace(/^voice-/, '') : null;

        set((state) => {
          const exists = state.chatSessions.some((s) => s.id === session.id);
          const chatSessions = exists
            ? state.chatSessions.map((s) =>
                s.id === session.id ? { ...session, messages: session.messages } : s,
              )
            : [session, ...state.chatSessions];

          return {
            chatHistory: session.messages,
            activeSessionId: session.id,
            dbChatSessionId: dbChatId,
            voiceDbSessionId: voiceDbId,
            currentProject: session.projectId ?? state.currentProject,
            agentMode: lastPlan ? 'planning' : 'chat',
            dashboardMode: isVoice ? 'voice' : 'text',
            buildPlan: lastPlan,
            chatSessions,
            voiceResume: voiceDbId
              ? {
                  sessionId: voiceDbId,
                  transcript: session.messages.map((m) => ({ role: m.role, text: m.text })),
                }
              : null,
          };
        });
      },

      linkActiveSessionToDb: (dbSessionId) =>
        set((state) => {
          const localId = state.activeSessionId;
          if (!localId || localId === dbSessionId) {
            return { dbChatSessionId: dbSessionId, activeSessionId: dbSessionId };
          }

          const localSession = state.chatSessions.find((s) => s.id === localId);
          if (!localSession) {
            return { dbChatSessionId: dbSessionId, activeSessionId: dbSessionId };
          }

          const migrated: ChatSession = {
            ...localSession,
            id: dbSessionId,
            source: 'chat',
          };
          const chatSessions = [
            migrated,
            ...state.chatSessions.filter((s) => s.id !== localId && s.id !== dbSessionId),
          ];

          return {
            dbChatSessionId: dbSessionId,
            activeSessionId: dbSessionId,
            chatSessions,
          };
        }),

      clearVoiceResume: () => set({ voiceResume: null }),

      setAgentMode: (mode) => set({ agentMode: mode }),
      setProjectFiles: (files) =>
        set((s) => ({
          projectFiles: files,
          fileVersion: s.fileVersion + 1,
        })),
      mergeProjectFiles: (files) =>
        set((s) => ({
          projectFiles: { ...s.projectFiles, ...files },
          fileVersion: s.fileVersion + 1,
        })),
      setActiveFile: (path) => set({ activeFile: path }),
      setBuildPlan: (plan) => set({ buildPlan: plan }),
      setSandboxViewMode: (mode) => set({ sandboxViewMode: mode }),
      setSandboxSidebarOpen: (open) => set({ sandboxSidebarOpen: open }),
      incrementFileVersion: () =>
        set((s) => ({ fileVersion: s.fileVersion + 1 })),
      setDbChatSessionId: (id) => set({ dbChatSessionId: id }),
      setVoiceDbSessionId: (id) => set({ voiceDbSessionId: id }),

      setActiveSessionFromDb: (dbSessionId) =>
        set((state) => {
          const session = state.chatSessions.find((s) => s.id === dbSessionId);
          return {
            activeSessionId: dbSessionId,
            dbChatSessionId: dbSessionId,
            chatHistory: session?.messages ?? state.chatHistory,
          };
        }),

      applyBulkSessionMappings: (mappings) =>
        set((state) => {
          let activeSessionId = state.activeSessionId;
          let dbChatSessionId = state.dbChatSessionId;
          let chatSessions = [...state.chatSessions];

          for (const { localId, dbSessionId } of mappings) {
            const localSession = chatSessions.find((s) => s.id === localId);
            if (!localSession) continue;

            const migrated: ChatSession = {
              ...localSession,
              id: dbSessionId,
              source: 'chat',
            };
            chatSessions = [
              migrated,
              ...chatSessions.filter((s) => s.id !== localId && s.id !== dbSessionId),
            ];

            if (activeSessionId === localId) {
              activeSessionId = dbSessionId;
              dbChatSessionId = dbSessionId;
            }
          }

          return { chatSessions, activeSessionId, dbChatSessionId };
        }),

      setPublishState: (ps) =>
        set((s) => ({
          publishStatus: ps.publishStatus ?? s.publishStatus,
          publishUrl: ps.publishUrl ?? s.publishUrl,
          publishDomain: ps.publishDomain ?? s.publishDomain,
          publishDeploymentId: ps.publishDeploymentId ?? s.publishDeploymentId,
          publishError: ps.publishError ?? s.publishError,
        })),
      clearPublishState: () =>
        set({
          publishStatus: 'idle',
          publishUrl: null,
          publishDomain: null,
          publishDeploymentId: null,
          publishError: null,
        }),
      enterLiveBuild: () =>
        set((s) => ({
          isBuilding: true,
          agentMode: 'sandbox',
          sandboxViewMode: 'preview',
          sandboxSidebarOpen: false,
          activeFile: null,
          projectFiles:
            Object.keys(s.projectFiles).length > 0
              ? s.projectFiles
              : getScaffoldForTier(s.selectedModel),
          fileVersion: s.fileVersion + 1,
        })),
      finishBuild: () => set({ isBuilding: false }),
      resetProject: () =>
        set({
          currentProject: null,
          projectFiles: {},
          activeFile: null,
          buildPlan: null,
          agentMode: 'projects',
          isBuilding: false,
          chatHistory: [],
          initialPrompt: null,
          activeSessionId: null,
          dbChatSessionId: null,
          voiceDbSessionId: null,
          voiceResume: null,
          sandboxViewMode: 'preview',
          sandboxSidebarOpen: false,
          publishStatus: 'idle',
          publishUrl: null,
          publishDomain: null,
          publishDeploymentId: null,
          publishError: null,
        }),
    }),
    {
      name: 'theo-app-store',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return localStorage;
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        username: state.username,
        selectedModel: state.selectedModel,
        v1TrialsUsed: state.v1TrialsUsed,
        chatHistory: state.chatHistory,
        chatSessions: state.chatSessions,
        activeSessionId: state.activeSessionId,
        dbChatSessionId: state.dbChatSessionId,
        voiceDbSessionId: state.voiceDbSessionId,
        currentProject: state.currentProject,
        projectFiles: state.projectFiles,
        buildPlan: state.buildPlan,
        dashboardMode: state.dashboardMode,
        activeFile: state.activeFile,
        sandboxViewMode: state.sandboxViewMode,
        sandboxSidebarOpen: state.sandboxSidebarOpen,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setAgentMode('projects');
          state.finishBuild();
          state.clearPublishState();
          const uuidRe =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (
            state.activeSessionId &&
            uuidRe.test(state.activeSessionId) &&
            !state.dbChatSessionId
          ) {
            state.setDbChatSessionId(state.activeSessionId);
          } else if (
            state.dbChatSessionId &&
            uuidRe.test(state.dbChatSessionId) &&
            !state.activeSessionId
          ) {
            state.setActiveSessionFromDb(state.dbChatSessionId);
          }
          state.setHasHydrated(true);
        }
      },
    },
  ),
);

export function useHydrated() {
  const hasHydrated = useAppStore((s) => s._hasHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasHydrated) setReady(true);
  }, [hasHydrated]);

  return ready;
}
