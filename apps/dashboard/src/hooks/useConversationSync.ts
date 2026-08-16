'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAppStore, useHydrated } from '@/store';
import {
  bulkSyncLocalSessions,
  drainSyncOutbox,
  ensureSessionMessages,
  isDbSessionId,
  loadChatHistoryFromServer,
  loadProjectFilesForSession,
  syncAuthUser,
} from '@/lib/conversations';

export function useConversationSync() {
  const { getAccessToken, authenticated: isSignedIn } = usePrivy();
  const getToken = useCallback(async () => await getAccessToken(), [getAccessToken]);
  
  const hydrated = useHydrated();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      syncedRef.current = false;
      useAppStore.getState().setDbChatSessionId(null);
      useAppStore.getState().setVoiceDbSessionId(null);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!hydrated || !isSignedIn || syncedRef.current) return;

    let cancelled = false;

    async function runSync() {
      await syncAuthUser(getToken);
      if (cancelled) return;

      const state = useAppStore.getState();
      const mappings = await bulkSyncLocalSessions(state.chatSessions, getToken);
      if (cancelled) return;

      if (mappings.length > 0) {
        useAppStore.getState().applyBulkSessionMappings(mappings);
      }

      await drainSyncOutbox(getToken);
      if (cancelled) return;

      const serverSessions = await loadChatHistoryFromServer(getToken);
      if (cancelled) return;
      useAppStore.getState().hydrateChatSessionsFromServer(serverSessions);

      const afterHydrate = useAppStore.getState();

      if (
        afterHydrate.activeSessionId &&
        isDbSessionId(afterHydrate.activeSessionId) &&
        afterHydrate.chatHistory.length === 0
      ) {
        const session = afterHydrate.chatSessions.find(
          (s) => s.id === afterHydrate.activeSessionId,
        );
        if (session) {
          const full = await ensureSessionMessages(session, getToken);
          if (!cancelled) {
            useAppStore.setState({ chatHistory: full.messages });
            if (full.projectId) {
              const files = await loadProjectFilesForSession(full.projectId, getToken);
              if (files) afterHydrate.setProjectFiles(files);
              afterHydrate.setCurrentProject(full.projectId);
            }
          }
        }
      }

      const final = useAppStore.getState();
      if (
        final.activeSessionId &&
        isDbSessionId(final.activeSessionId) &&
        !final.activeSessionId.startsWith('voice-') &&
        !final.dbChatSessionId
      ) {
        final.setDbChatSessionId(final.activeSessionId);
      } else if (final.dbChatSessionId && isDbSessionId(final.dbChatSessionId) && !final.activeSessionId) {
        final.setActiveSessionFromDb(final.dbChatSessionId);
      }

      syncedRef.current = true;
    }

    void runSync().catch(() => {
      syncedRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isSignedIn, getToken]);
}
