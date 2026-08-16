'use client';

import { API_BASE, apiFetch } from './api';

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

export interface StreamBuildCallbacks {
  onProgress?: (message: string, stage?: string) => void;
  onFile?: (path: string, content: string, files: Record<string, string>) => void;
  onDone?: (result: {
    projectId: string;
    filesGenerated: number;
    skillsUsed?: string[];
    files: Record<string, string>;
  }) => void;
  onError?: (message: string) => void;
}

export async function streamBuild(
  description: string,
  options: {
    channel?: 'chat' | 'voice';
    projectId?: string;
    sessionId?: string | null;
    getToken?: GetTokenFn;
    initialFiles?: Record<string, string>;
    model?: string;
    walletAddress?: string | null;
  } & StreamBuildCallbacks,
): Promise<void> {
  const { channel = 'chat', projectId, sessionId, getToken, initialFiles, model, walletAddress, onProgress, onFile, onDone, onError } =
    options;

  const body = JSON.stringify({
    description,
    projectId,
    channel,
    sessionId: sessionId ?? undefined,
    model: model ?? undefined,
    walletAddress: walletAddress ?? undefined,
  });

  const res = getToken
    ? await apiFetch(
        '/ai/generate/stream',
        {
          method: 'POST',
          body,
        },
        getToken,
      )
    : await fetch(`${API_BASE}/ai/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    onError?.(err.error ?? 'Stream request failed');
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError?.('No response stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const files: Record<string, string> = { ...(initialFiles ?? {}) };
  let currentEvent = 'message';

  const dispatch = (event: string, data: string) => {
    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      if (event === 'progress') {
        onProgress?.(
          String(parsed.message ?? 'Building...'),
          parsed.stage ? String(parsed.stage) : undefined,
        );
      } else if (event === 'file') {
        const path = String(parsed.path ?? '');
        const content = String(parsed.content ?? '');
        if (path) {
          files[path] = content;
          onFile?.(path, content, { ...files });
        }
      } else if (event === 'done') {
        onDone?.({
          projectId: String(parsed.projectId ?? ''),
          filesGenerated: Number(parsed.filesGenerated ?? Object.keys(files).length),
          skillsUsed: parsed.skillsUsed as string[] | undefined,
          files: { ...files },
        });
      } else if (event === 'error') {
        onError?.(String(parsed.message ?? 'Build failed'));
      }
    } catch {
      /* ignore malformed events */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let event = currentEvent;
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data = line.slice(5).trim();
        }
      }
      if (data) {
        currentEvent = event;
        dispatch(event, data);
      }
    }
  }
}
