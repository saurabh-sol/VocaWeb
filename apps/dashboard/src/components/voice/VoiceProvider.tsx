'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuthSession } from '@/lib/auth';
import {
  VoiceClient,
  AudioManager,
  voiceTools,
  VOICE_SYSTEM_PROMPT,
  type VoiceClientConfig,
} from '@/lib/voice';
import { useAppStore, type ModelTier } from '@/store';
import { apiFetch } from '@/lib/api';
import { streamBuild } from '@/lib/stream-build';
import {
  startVoiceSession,
  syncVoiceTranscript,
  endVoiceSession,
} from '@/lib/conversations';
import type { TranscriptMessage } from './TranscriptPanel';

interface VoiceContextValue {
  isConnected: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isBuilding: boolean;
  micError: string | null;
  transcript: TranscriptMessage[];
  partialUserText: string;
  partialAssistantText: string;
  analyserNode: AnalyserNode | null;
  hasCapturedAudio: boolean;
  canUseMic: boolean;
  pendingUserText: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendVoiceTurn: () => Promise<void>;
  clearMicError: () => void;
  saveTranscript: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within <VoiceProvider>');
  return ctx;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const VOICE_WS_URL = API_BASE.replace(/^http/, 'ws') + '/voice/realtime';
// const VOICE_HTTP_BASE = API_BASE.replace(/\/api$/, '') + '/api/voice';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createSpeechRecognition(): BrowserSpeechRecognition | null {
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) return null;
  return new SR();
}

const BUILD_TOOLS = new Set([
  'build_website',
  'edit_code',
  'change_style',
  'add_section',
  'fix_error',
]);

interface VoiceBuildResult {
  success: boolean;
  message: string;
}

function hasProjectFiles(files?: Record<string, string>): boolean {
  return !!files && Object.keys(files).length > 0;
}

function formatTranscriptForApi(messages: TranscriptMessage[]): string {
  return messages
    .map((m) => {
      const ts = m.timestamp ? `[${m.timestamp}] ` : '';
      return `${ts}${m.role === 'user' ? 'User' : 'VocaWeb'}: ${m.text}`;
    })
    .join('\n');
}

const USER_MERGE_WINDOW_MS = 500;

function mergeUserIntoTranscript(
  prev: TranscriptMessage[],
  text: string,
  lastUserMsgTimeRef: { current: number | null },
): TranscriptMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return prev;

  const now = Date.now();
  const last = prev[prev.length - 1];
  if (
    last?.role === 'user' &&
    lastUserMsgTimeRef.current &&
    now - lastUserMsgTimeRef.current < USER_MERGE_WINDOW_MS
  ) {
    lastUserMsgTimeRef.current = now;
    return [...prev.slice(0, -1), { role: 'user', text: `${last.text} ${trimmed}`.trim() }];
  }

  lastUserMsgTimeRef.current = now;
  return [...prev, { role: 'user', text: trimmed }];
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuthSession();
  const currentProject = useAppStore((s) => s.currentProject);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const setProjectFiles = useAppStore((s) => s.setProjectFiles);
  const mergeProjectFiles = useAppStore((s) => s.mergeProjectFiles);
  const finishBuild = useAppStore((s) => s.finishBuild);
  const enterLiveBuild = useAppStore((s) => s.enterLiveBuild);
  const setAgentMode = useAppStore((s) => s.setAgentMode);

  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [partialUserText, setPartialUserText] = useState('');
  const [partialAssistantText, setPartialAssistantText] = useState('');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [hasCapturedAudio, setHasCapturedAudio] = useState(false);
  const [isAwaitingGreeting, setIsAwaitingGreeting] = useState(false);
  const [pendingUserText, setPendingUserText] = useState('');

  const clientRef = useRef<VoiceClient | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const aiTextBuffer = useRef('');
  const userTextBuffer = useRef('');
  const isAwaitingTranscriptionRef = useRef(false);
  const userTurnCommittedRef = useRef(false);
  const initialGreetingSentRef = useRef(false);
  const pendingUserTextRef = useRef('');
  const responseTriggeredRef = useRef(false);
  const lastUserMsgTimeRef = useRef<number | null>(null);
  const transcriptionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const buildingRef = useRef(false);
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const voiceDbSessionIdRef = useRef<string | null>(null);
  const voiceSessionStartedRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  transcriptRef.current = transcript;

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const voiceResume = useAppStore((s) => s.voiceResume);
  const clearVoiceResume = useAppStore((s) => s.clearVoiceResume);
  const voiceDbSessionId = useAppStore((s) => s.voiceDbSessionId);
  const setVoiceDbSessionId = useAppStore((s) => s.setVoiceDbSessionId);

  useEffect(() => {
    if (voiceDbSessionId && !voiceDbSessionIdRef.current) {
      voiceDbSessionIdRef.current = voiceDbSessionId;
    }
  }, [voiceDbSessionId]);

  useEffect(() => {
    if (!voiceResume) return;
    setTranscript(voiceResume.transcript);
    voiceDbSessionIdRef.current = voiceResume.sessionId;
    setVoiceDbSessionId(voiceResume.sessionId);
    clearVoiceResume();
  }, [voiceResume, clearVoiceResume, setVoiceDbSessionId]);

  const canUseMic =
    isConnected &&
    !isRecording &&
    !isSpeaking &&
    !isProcessing &&
    !isBuilding &&
    !isAwaitingGreeting;

  const triggerAgentResponse = useCallback((client: VoiceClient) => {
    if (responseTriggeredRef.current) return;
    responseTriggeredRef.current = true;
    client.createResponse();
  }, []);

  const commitUserMessage = useCallback((text: string) => {
    if (userTurnCommittedRef.current) return;
    userTurnCommittedRef.current = true;
    const trimmed = text.trim();
    pendingUserTextRef.current = '';
    setPendingUserText('');
    setPartialUserText('');
    userTextBuffer.current = '';
    if (trimmed) {
      setTranscript((prev) => mergeUserIntoTranscript(prev, trimmed, lastUserMsgTimeRef));
    }
  }, []);

  const syncTranscriptToDb = useCallback(async () => {
    const sessionId = voiceDbSessionIdRef.current;
    if (!sessionId || transcriptRef.current.length === 0) return;
    await syncVoiceTranscript(
      sessionId,
      transcriptRef.current.map((m) => ({ role: m.role, text: m.text })),
      getToken,
      currentProjectRef.current ?? undefined,
    );
  }, [getToken]);

  useEffect(() => {
    if (transcript.length === 0 || !voiceDbSessionIdRef.current) return;
    const timer = setTimeout(() => {
      void syncTranscriptToDb();
    }, 500);
    return () => clearTimeout(timer);
  }, [transcript, syncTranscriptToDb]);

  useEffect(() => {
    const flush = () => {
      void syncTranscriptToDb();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncTranscriptToDb]);

  const runVoiceBuild = useCallback(
    async (description: string, style?: string): Promise<VoiceBuildResult> => {
      const transcriptText = formatTranscriptForApi(transcriptRef.current);
      const fullDescription = style ? `${description}. Style: ${style}` : description;
      const contextDescription = transcriptText
        ? `${fullDescription}\n\nVoice conversation context:\n${transcriptText}`
        : fullDescription;

      let buildComplete = false;
      let streamError = '';

      try {
        const currentFiles = useAppStore.getState().projectFiles;
        const currentModel = useAppStore.getState().selectedModel;
        await streamBuild(contextDescription, {
          channel: 'voice',
          getToken,
          initialFiles: currentFiles,
          model: currentModel,
          onFile: (_path, _content, files) => {
            mergeProjectFiles(files);
          },
          onDone: (result) => {
            buildComplete = true;
            setCurrentProject(result.projectId);
            setProjectFiles(result.files);
            finishBuild();
          },
          onError: (message) => {
            streamError = message;
            buildComplete = false;
            finishBuild();
          },
        });
      } catch (err) {
        streamError =
          err instanceof Error
            ? err.message
            : 'Could not reach the build server. Check your connection and try again.';
        finishBuild();
      }

      if (buildComplete) {
        setAgentMode('sandbox');
        return {
          success: true,
          message: 'Your site is ready — opening Sandbox preview now.',
        };
      }

      try {
        const currentModel = useAppStore.getState().selectedModel;
        const res = await apiFetch(
          '/ai/voice/action',
          {
            method: 'POST',
            body: JSON.stringify({
              tool: 'build_website',
              args: { description, style },
              transcript: transcriptText || undefined,
              model: currentModel,
            }),
          },
          getToken,
        );

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          return {
            success: false,
            message:
              streamError ||
              err.error ||
              `Build failed (HTTP ${res.status}). The preview could not be generated.`,
          };
        }

        const data = (await res.json()) as {
          success: boolean;
          message: string;
          projectId?: string;
          files?: Record<string, string>;
        };

        if (hasProjectFiles(data.files) && data.projectId) {
          setCurrentProject(data.projectId);
          setProjectFiles(data.files!);
          finishBuild();
          setAgentMode('sandbox');
          return {
            success: true,
            message: data.message || 'Your site is ready — opening Sandbox preview now.',
          };
        }

        return {
          success: false,
          message:
            streamError ||
            data.message ||
            'Build failed — no project files were returned. Try again or use Chat mode.',
        };
      } catch {
        return {
          success: false,
          message:
            streamError ||
            'Could not reach the build server. Check your connection and try again.',
        };
      }
    },
    [getToken, setCurrentProject, setProjectFiles, finishBuild, setAgentMode],
  );

  const handleFunctionCall = useCallback(
    async (callId: string, name: string, args: Record<string, unknown>) => {
      const client = clientRef.current;
      if (!client || buildingRef.current) return;

      if (BUILD_TOOLS.has(name)) {
        buildingRef.current = true;
        setIsBuilding(true);
        setMicError(null);
        if (name === 'build_website') {
          enterLiveBuild();
        }
      }

      try {
        if (name === 'build_website') {
          const description = String(args.description ?? '').trim();
          const style = args.style ? String(args.style) : undefined;
          const data = await runVoiceBuild(description, style);

          if (data.success) {
            setMicError(null);
            setTranscript((prev) => [
              ...prev,
              {
                role: 'assistant',
                text: data.message,
              },
            ]);
          } else {
            setMicError(data.message);
            setTranscript((prev) => [
              ...prev,
              {
                role: 'assistant',
                text: `Build failed: ${data.message}`,
              },
            ]);
          }

          client.submitFunctionResult(
            callId,
            data.success
              ? data.message
              : `Build failed: ${data.message}`,
          );
          return;
        }

        const transcriptText = formatTranscriptForApi(transcriptRef.current);
        const toolModel = useAppStore.getState().selectedModel;
        const res = await apiFetch(
          '/ai/voice/action',
          {
            method: 'POST',
            body: JSON.stringify({
              tool: name,
              args,
              projectId: currentProjectRef.current ?? undefined,
              transcript: transcriptText || undefined,
              model: toolModel,
            }),
          },
          getToken,
        );

        const data = (await res.json()) as {
          success: boolean;
          message: string;
          projectId?: string;
          files?: Record<string, string>;
        };

        if (hasProjectFiles(data.files) && data.projectId) {
          setCurrentProject(data.projectId);
          setProjectFiles(data.files!);
          finishBuild();
          setAgentMode('sandbox');
        } else if (BUILD_TOOLS.has(name)) {
          setMicError(data.message || 'Update failed — no files were returned.');
        }

        client.submitFunctionResult(
          callId,
          data.message ?? (data.success ? 'Done.' : 'Something went wrong.'),
        );

        if (BUILD_TOOLS.has(name)) {
          setTranscript((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: data.success
                ? (data.message ?? 'Update complete.')
                : `Update failed: ${data.message ?? 'Something went wrong.'}`,
            },
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Build failed';
        client.submitFunctionResult(callId, `Error: ${msg}`);
        setMicError(msg);
      } finally {
        if (BUILD_TOOLS.has(name)) {
          buildingRef.current = false;
          setIsBuilding(false);
          finishBuild();
        }
      }
    },
    [getToken, enterLiveBuild, setCurrentProject, setProjectFiles, finishBuild, runVoiceBuild, setAgentMode],
  );

  const connect = useCallback(async () => {
    if (clientRef.current) return;

    const config: VoiceClientConfig = {
      token: 'proxy',
      voice: 'eve',
      systemPrompt: VOICE_SYSTEM_PROMPT,
      tools: voiceTools,
      wsUrl: VOICE_WS_URL,
    };

    const client = new VoiceClient(config);
    const audio = new AudioManager();

    client.on('connected', () => setIsConnected(true));

    client.on('disconnected', () => {
      setIsConnected(false);
      setIsRecording(false);
      setIsProcessing(false);
      setIsSpeaking(false);
      setIsUserSpeaking(false);
      setIsAwaitingGreeting(false);
      setPartialUserText('');
      setPartialAssistantText('');
      setPendingUserText('');
      pendingUserTextRef.current = '';
      isAwaitingTranscriptionRef.current = false;
      userTextBuffer.current = '';
      userTurnCommittedRef.current = false;
      initialGreetingSentRef.current = false;
      setHasCapturedAudio(false);
    });

    client.on('userSpeaking', (speaking) => {
      setIsUserSpeaking(speaking);
    });

    client.on('speaking', (speaking) => {
      setIsSpeaking(speaking);
      if (!speaking) {
        setIsAwaitingGreeting(false);
        if (aiTextBuffer.current) {
          const text = aiTextBuffer.current;
          aiTextBuffer.current = '';
          setPartialAssistantText('');
          setTranscript((prev) => [...prev, { role: 'assistant', text }]);
        }
      }
    });

    client.on('userTranscriptUpdate', (text, isFinal) => {
      const trimmed = text.trim();
      if (!trimmed && !isFinal) return;

      const recording = isRecordingRef.current;
      const processing = isProcessingRef.current;

      if (!isFinal || (recording && !isAwaitingTranscriptionRef.current)) {
        if (recording || processing) {
          setPartialUserText((prev) =>
            trimmed.length >= prev.length ? trimmed : prev,
          );
          if (trimmed.length >= userTextBuffer.current.length) {
            userTextBuffer.current = trimmed;
          }
        }
        if (!isFinal) return;
      }

      if (!isAwaitingTranscriptionRef.current) return;

      if (transcriptionTimeoutRef.current) {
        clearTimeout(transcriptionTimeoutRef.current);
        transcriptionTimeoutRef.current = null;
      }

      isAwaitingTranscriptionRef.current = false;
      setIsProcessing(false);
      isProcessingRef.current = false;

      const finalText =
        trimmed || userTextBuffer.current.trim() || pendingUserTextRef.current;
      commitUserMessage(finalText);
      triggerAgentResponse(client);
    });

    client.on('assistantTranscriptUpdate', (text, isFinal) => {
      if (isFinal) {
        if (text.trim()) {
          aiTextBuffer.current = text;
          setPartialAssistantText(text);
        }
        return;
      }
      aiTextBuffer.current += text;
      setPartialAssistantText(aiTextBuffer.current);
    });

    client.on('audioResponse', (pcmData) => {
      audio.playAudio(pcmData);
    });

    client.on('functionCall', (callId, name, args) => {
      void handleFunctionCall(callId, name, args);
    });

    client.on('error', (err) => {
      console.error('[VocaWeb] Voice error:', err);
      setMicError(err.message || 'Voice connection error');
    });

    audio.onAudioData((pcm) => {
      setHasCapturedAudio(true);
      client.sendAudio(pcm);
    });

    clientRef.current = client;
    audioRef.current = audio;

    try {
      await client.connect();

      if (!initialGreetingSentRef.current) {
        initialGreetingSentRef.current = true;
        setIsAwaitingGreeting(true);
        client.createResponse();
      }
    } catch (err: unknown) {
      clientRef.current = null;
      audioRef.current = null;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (msg.includes('WebSocket connection failed')) {
        setMicError(
          'Cannot connect to voice server. Make sure the API server is running (pnpm dev).',
        );
      } else {
        setMicError(msg);
      }
      throw err;
    }
  }, [handleFunctionCall, commitUserMessage, triggerAgentResponse]);

  const stopSpeechRecognition = useCallback((clearPartial = true) => {
    if (speechRecRef.current) {
      const rec = speechRecRef.current;
      speechRecRef.current = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    if (clearPartial) {
      setPartialUserText('');
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (transcriptionTimeoutRef.current) {
      clearTimeout(transcriptionTimeoutRef.current);
      transcriptionTimeoutRef.current = null;
    }

    isAwaitingTranscriptionRef.current = false;
    responseTriggeredRef.current = false;
    userTurnCommittedRef.current = false;
    pendingUserTextRef.current = '';
    userTextBuffer.current = '';
    aiTextBuffer.current = '';

    if (isRecordingRef.current) {
      stopSpeechRecognition();
      audioRef.current?.stopMic();
      isRecordingRef.current = false;
      setIsRecording(false);
    }

    clientRef.current?.interrupt();
    stopSpeechRecognition();
    audioRef.current?.stopMic();
    audioRef.current?.stopPlayback();

    if (voiceDbSessionIdRef.current) {
      const duration = voiceSessionStartedRef.current
        ? Math.round((Date.now() - voiceSessionStartedRef.current) / 1000)
        : 0;
      await syncTranscriptToDb();
      await endVoiceSession(voiceDbSessionIdRef.current, getToken, duration);
      voiceDbSessionIdRef.current = null;
      setVoiceDbSessionId(null);
      voiceSessionStartedRef.current = null;
    }

    clientRef.current?.disconnect();
    clientRef.current = null;
    audioRef.current = null;

    setTranscript([]);
    setAnalyserNode(null);
    setIsConnected(false);
    setIsRecording(false);
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setIsBuilding(false);
    buildingRef.current = false;
    finishBuild();
    setPartialUserText('');
    setPartialAssistantText('');
    setPendingUserText('');
    isAwaitingTranscriptionRef.current = false;
    initialGreetingSentRef.current = false;
    setIsAwaitingGreeting(false);
    setHasCapturedAudio(false);
    setMicError(null);
  }, [stopSpeechRecognition, syncTranscriptToDb, getToken, setVoiceDbSessionId, finishBuild]);

  const startSpeechRecognition = useCallback(() => {
    try {
      const rec = createSpeechRecognition();
      if (!rec) return;

      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            userTextBuffer.current = `${userTextBuffer.current} ${result[0].transcript}`.trim();
          } else {
            interim += result[0].transcript;
          }
        }
        const display = `${userTextBuffer.current}${interim ? ` ${interim}` : ''}`.trim();
        if (display) {
          setPartialUserText(display);
        }
      };

      rec.onerror = () => {};

      rec.onend = () => {
        if (speechRecRef.current === rec && isRecordingRef.current) {
          try {
            rec.start();
          } catch {
            /* already stopped */
          }
        }
      };

      rec.start();
      speechRecRef.current = rec;
    } catch {
      /* SpeechRecognition not available */
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!clientRef.current || !audioRef.current) return;

    if (isSpeaking || isProcessing || isAwaitingGreeting) {
      setMicError('Please wait for VocaWeb to finish speaking first.');
      return;
    }

    setMicError(null);
    clientRef.current.clearAudioBuffer();
    userTextBuffer.current = '';
    userTurnCommittedRef.current = false;
    pendingUserTextRef.current = '';
    setPendingUserText('');
    setPartialUserText('');
    setHasCapturedAudio(false);
    try {
      if (!voiceDbSessionIdRef.current) {
        const sid = await startVoiceSession(getToken, currentProjectRef.current ?? undefined);
        if (sid) {
          voiceDbSessionIdRef.current = sid;
          setVoiceDbSessionId(sid);
          voiceSessionStartedRef.current = Date.now();
        }
      }
      await audioRef.current.startMic();
      setAnalyserNode(audioRef.current.getAnalyser());
      setIsRecording(true);
      isRecordingRef.current = true;
      setIsSpeaking(false);
      startSpeechRecognition();
    } catch (err: unknown) {
      setIsRecording(false);
      isRecordingRef.current = false;
      stopSpeechRecognition();
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'MIC_PERMISSION_DENIED') {
        setMicError(
          'Microphone access denied. Please allow microphone permission in your browser and system settings.',
        );
      } else if (msg === 'MIC_NOT_FOUND') {
        setMicError('No microphone found. Please connect a microphone and try again.');
      } else if (msg === 'MIC_NOT_SUPPORTED') {
        setMicError(
          'Your browser does not support microphone access. Please use Chrome, Edge, or Safari.',
        );
      } else {
        setMicError('Failed to access microphone. Please check your permissions.');
      }
      throw err;
    }
  }, [startSpeechRecognition, getToken, isSpeaking, isProcessing, isAwaitingGreeting, setVoiceDbSessionId]);

  const stopRecording = useCallback(async () => {
    await syncTranscriptToDb();
    stopSpeechRecognition();
    audioRef.current?.stopMic();
    setAnalyserNode(null);
    setIsRecording(false);
    isRecordingRef.current = false;
    isAwaitingTranscriptionRef.current = false;
    setIsProcessing(false);
    isProcessingRef.current = false;
  }, [stopSpeechRecognition, syncTranscriptToDb]);

  const sendVoiceTurn = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !isRecording) return;

    const fallbackText = userTextBuffer.current.trim() || partialUserText.trim();
    if (!hasCapturedAudio && !fallbackText) {
      setMicError('No speech detected. Please speak before stopping.');
      return;
    }

    pendingUserTextRef.current = fallbackText;
    setPendingUserText(fallbackText);
    userTurnCommittedRef.current = false;
    responseTriggeredRef.current = false;

    stopSpeechRecognition(false);
    audioRef.current?.stopMic();
    setAnalyserNode(null);
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsProcessing(true);
    isProcessingRef.current = true;
    isAwaitingTranscriptionRef.current = true;

    client.commitAudioBuffer();

    transcriptionTimeoutRef.current = setTimeout(() => {
      if (!isAwaitingTranscriptionRef.current) return;
      isAwaitingTranscriptionRef.current = false;
      setIsProcessing(false);
      isProcessingRef.current = false;
      const text =
        userTextBuffer.current.trim() ||
        partialUserText.trim() ||
        pendingUserTextRef.current;
      commitUserMessage(text);
      triggerAgentResponse(client);
      transcriptionTimeoutRef.current = null;
    }, 5000);
  }, [isRecording, partialUserText, hasCapturedAudio, stopSpeechRecognition, commitUserMessage, triggerAgentResponse]);

  const clearMicError = useCallback(() => setMicError(null), []);

  const saveTranscript = useCallback(async () => {
    if (transcript.length === 0) return;
    await syncTranscriptToDb();
    if (voiceDbSessionIdRef.current) {
      const duration = voiceSessionStartedRef.current
        ? Math.round((Date.now() - voiceSessionStartedRef.current) / 1000)
        : 0;
      await endVoiceSession(voiceDbSessionIdRef.current, getToken, duration);
    }
    try {
      await apiFetch(
        '/voice/transcripts',
        {
          method: 'POST',
          body: JSON.stringify({
            sessionId: voiceDbSessionIdRef.current ?? undefined,
            messages: transcript.map((m) => ({
              role: m.role,
              text: m.text,
              timestamp: new Date().toISOString(),
            })),
            projectId: currentProjectRef.current ?? undefined,
          }),
        },
        getToken,
      );
    } catch (err) {
      console.error('[VocaWeb] Failed to save transcript:', err);
    }
  }, [transcript, syncTranscriptToDb, getToken]);

  return (
    <VoiceContext.Provider
      value={{
        isConnected,
        isRecording,
        isProcessing,
        isSpeaking,
        isUserSpeaking,
        isBuilding,
        micError,
        transcript,
        partialUserText,
        partialAssistantText,
        analyserNode,
        hasCapturedAudio,
        canUseMic,
        pendingUserText,
        connect,
        disconnect,
        startRecording,
        stopRecording,
        sendVoiceTurn,
        clearMicError,
        saveTranscript,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
