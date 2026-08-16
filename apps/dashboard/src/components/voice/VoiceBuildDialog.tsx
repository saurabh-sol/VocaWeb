'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { useVoice } from './VoiceProvider';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { ModelSelector } from '@/components/shared/ModelSelector';

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
      console.error('[Vocaweb] Mic error:', err);
    }
  };

  const handleStopAndSend = async () => {
    clearMicError();
    try {
      await sendVoiceTurn();
    } catch (err) {
      console.error('[Vocaweb] Send error:', err);
    }
  };

  const handleEndSession = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('[Vocaweb] End session error:', err);
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

  return (
    <div className="relative flex flex-col h-full rounded-2xl border border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-[var(--border)]/30 bg-transparent max-md:px-3 max-md:py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <Mic className="h-5 w-5 text-[var(--primary-foreground)]" />
            </div>
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-full bg-[var(--primary)]"
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--foreground)]">Vocaweb Voice</h2>
            <p className="text-xs text-[var(--muted-foreground)] max-md:truncate">
              {isBuilding
                ? 'Building your website...'
                : isRecording
                  ? 'Recording... click Stop when done'
                  : isProcessing
                    ? 'Processing your message...'
                    : isSpeaking || !canUseMic
                      ? 'Vocaweb is responding... wait to speak'
                      : isConnected
                        ? 'Connected — click mic when ready to speak'
                        : 'Click mic to connect'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ModelSelector />
          {(isConnected || transcript.length > 0) && (
            <button
              type="button"
              onClick={() => void handleEndSession()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <Square className="w-3 h-3" />
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 max-md:px-3">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
            <div className="h-16 w-16 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Mic className="h-7 w-7 text-[var(--muted-foreground)]" />
            </div>
            <div>
              <p className="text-lg font-medium text-[var(--foreground)] mb-1">
                Tell Vocaweb what to build
              </p>
              <p className="text-sm text-[var(--muted-foreground)] max-w-md">
                Describe your website out loud. When you&apos;re done speaking, click Stop &amp; Send
                — Vocaweb will respond after that.
              </p>
            </div>
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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--background)]/80 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-[var(--primary)] animate-spin mb-4" />
          <p className="text-sm font-medium text-[var(--foreground)]">Building your website</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Live preview opening...
          </p>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="border-t border-[var(--border)]/30 bg-transparent px-6 py-4 max-md:px-3">
        <AnimatePresence>
          {micError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-3 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-center"
            >
              {micError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-4">
          {!isRecording && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartMic}
              disabled={isBuilding || isRecording || (!canUseMic && isConnected)}
              className={`relative p-4 rounded-full shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--primary)] text-[var(--primary-foreground)] hover:shadow-xl`}
            >
              <Mic className="w-6 h-6" />
            </motion.button>
          )}

          {isRecording && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: canSend ? 1.05 : 1 }}
              whileTap={{ scale: canSend ? 0.95 : 1 }}
              onClick={handleStopAndSend}
              disabled={!canSend || isBuilding}
              className="flex items-center gap-2 px-6 py-3 rounded-full shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-500 text-white hover:shadow-xl"
            >
              <Send className="w-5 h-5" />
              <span className="text-sm font-semibold">Stop &amp; Send</span>
            </motion.button>
          )}
        </div>

        {(isRecording || (!canUseMic && isConnected && !isBuilding)) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-center text-[var(--muted-foreground)] mt-2"
          >
            {isRecording
              ? 'Speak as long as you need — click Stop & Send when finished'
              : 'Wait for Vocaweb to finish — then click mic to speak'}
          </motion.p>
        )}
      </div>
    </div>
  );
}
