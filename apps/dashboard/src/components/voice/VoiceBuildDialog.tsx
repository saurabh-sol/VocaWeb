'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { useVoice } from './VoiceProvider';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Notice } from '@/components/ui/tag';

export function VoiceBuildDialog() {
  const {
    isConnected,
    isRecording,
    isProcessing,
    isSpeaking,
    isBuilding,
    transcript,
    partialUserText,
    partialAssistantText,
    pendingUserText,
    analyserNode,
    micError,
    hasCapturedAudio,
    canUseMic,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendVoiceTurn,
    clearMicError,
  } = useVoice();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, partialUserText, partialAssistantText, isSpeaking, isRecording, isProcessing]);

  const handleStartMic = async () => {
    clearMicError();
    try {
      if (!isConnected) {
        await connect();
        return;
      }
      if (!canUseMic) return;
      await startRecording();
    } catch (err) {
      console.error('[VocaWeb] Mic error:', err);
    }
  };

  const handleStopAndSend = async () => {
    clearMicError();
    try {
      await sendVoiceTurn();
    } catch (err) {
      console.error('[VocaWeb] Send error:', err);
    }
  };

  const handleEndSession = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('[VocaWeb] End session error:', err);
    }
  };

  const hasMessages =
    transcript.length > 0 ||
    !!partialUserText ||
    !!partialAssistantText ||
    isSpeaking ||
    isRecording ||
    isProcessing ||
    !!pendingUserText;

  const canSend = isRecording && (hasCapturedAudio || !!partialUserText.trim());

  const statusLabel = isBuilding
    ? 'Building your website'
    : isRecording
      ? 'Recording. Press Stop and send when you are done'
      : isProcessing
        ? 'Processing your message'
        : isSpeaking || !canUseMic
          ? 'VocaWeb is answering, wait to speak'
          : isConnected
            ? 'Connected. Press the mic when you are ready'
            : 'Press the mic to connect';

  return (
    <div className="vw-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-30 flex items-center justify-between gap-3 border-b-[1.5px] border-rule px-5 py-3.5 max-md:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative shrink-0">
            <span className="grid h-10 w-10 place-items-center rounded-lg border-[1.5px] border-rule bg-ink text-paper">
              <Mic className="h-5 w-5" aria-hidden />
            </span>
            {isRecording && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-lg border-[1.5px] border-bad"
                animate={{ scale: [1, 1.45], opacity: [0.7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-tight">VocaWeb Voice</h2>
            <p className="truncate font-mono text-[11.5px] text-dim" role="status">
              {statusLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ModelSelector />
          {(isConnected || transcript.length > 0) && (
            <Button size="sm" onClick={() => void handleEndSession()}>
              <Square className="h-3 w-3" aria-hidden />
              End session
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 max-md:px-3">
        {!hasMessages && (
          <div className="flex h-full items-center justify-center py-6">
            <EmptyState
              icon={<Mic className="h-6 w-6" aria-hidden />}
              title="Tell VocaWeb what to build"
              className="w-full max-w-[520px] border-0 bg-transparent"
            >
              Describe your website out loud. When you finish speaking, press Stop and send, and
              VocaWeb answers.
            </EmptyState>
          </div>
        )}

        {hasMessages && (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {transcript.map((msg, i) => (
                <VoiceMessageBubble
                  key={`msg-${i}`}
                  role={msg.role}
                  text={msg.text}
                  variant="completed"
                />
              ))}
            </AnimatePresence>

            {(isRecording || (isProcessing && pendingUserText)) && (
              <VoiceMessageBubble
                role="user"
                text={
                  isRecording
                    ? partialUserText || undefined
                    : pendingUserText || partialUserText || undefined
                }
                variant={isRecording ? 'live' : 'completed'}
                analyser={isRecording ? analyserNode : null}
                showCursor={isRecording && !!partialUserText}
              />
            )}

            {isProcessing && !pendingUserText && (
              <VoiceMessageBubble role="user" variant="live" analyser={null} />
            )}

            {isSpeaking && (
              <VoiceMessageBubble
                role="assistant"
                text={partialAssistantText || undefined}
                variant={partialAssistantText ? 'streaming' : 'live'}
              />
            )}
          </div>
        )}
      </div>

      {/* Building overlay */}
      {isBuilding && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--vw-paper)_88%,transparent)]"
        >
          <Loader2 className="mb-4 h-10 w-10 animate-spin" aria-hidden />
          <p className="font-display text-[17px] font-semibold">Building your website</p>
          <p className="mt-1 font-mono text-[11.5px] text-dim">The live preview opens next</p>
        </div>
      )}

      {/* Controls */}
      <div className="border-t-[1.5px] border-rule px-5 py-4 max-md:px-3">
        <AnimatePresence>
          {micError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-4"
            >
              <Notice tone="bad" role="alert" className="text-center text-[12.5px]">
                {micError}
              </Notice>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-4">
          {!isRecording && (
            <Button
              variant="primary"
              onClick={handleStartMic}
              disabled={isBuilding || isRecording || (!canUseMic && isConnected)}
              aria-label={isConnected ? 'Start recording' : 'Connect the microphone'}
              className="!h-14 !w-14 !rounded-full !p-0"
            >
              <Mic className="h-6 w-6" aria-hidden />
            </Button>
          )}

          {isRecording && (
            <Button
              onClick={handleStopAndSend}
              disabled={!canSend || isBuilding}
              size="lg"
              className="!rounded-full !border-bad !bg-bad !text-paper"
            >
              <Send className="h-5 w-5" aria-hidden />
              Stop and send
            </Button>
          )}
        </div>

        {(isRecording || (!canUseMic && isConnected && !isBuilding)) && (
          <p className="mt-3 text-center text-xs text-dim">
            {isRecording
              ? 'Speak as long as you need, then press Stop and send'
              : 'Wait for VocaWeb to finish, then press the mic to speak'}
          </p>
        )}
      </div>
    </div>
  );
}
