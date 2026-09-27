'use client';

import { Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from './VoiceProvider';
import { AudioWaveform } from './AudioWaveform';

type VoiceState = 'idle' | 'recording' | 'speaking';

function useVoiceState(): VoiceState {
  const { isRecording, isSpeaking } = useVoice();
  if (isRecording) return 'recording';
  if (isSpeaking) return 'speaking';
  return 'idle';
}

const stateColors: Record<VoiceState, { bg: string; ring: string; icon: string }> = {
  idle: {
    bg: 'bg-[var(--primary)]',
    ring: 'ring-[var(--border)]',
    icon: 'text-[var(--primary-foreground)]',
  },
  recording: {
    bg: 'bg-red-600',
    ring: 'ring-red-500/50',
    icon: 'text-white',
  },
  speaking: {
    bg: 'bg-[var(--accent)]',
    ring: 'ring-[var(--border)]',
    icon: 'text-[var(--accent-foreground)]',
  },
};

export function VoiceButton() {
  const { isConnected, connect, disconnect, startRecording, sendVoiceTurn, micError, analyserNode, canUseMic } = useVoice();
  const state = useVoiceState();
  const colors = stateColors[state];

  const handlePointerDown = async () => {
    try {
      if (!isConnected) {
        await connect();
        return;
      }
      if (!canUseMic) return;
      await startRecording();
    } catch (err) {
      console.error('[VocaWeb] VoiceButton mic error:', err);
    }
  };

  const handlePointerUp = () => {
    void sendVoiceTurn();
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-3">
      {micError && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="max-w-[240px] rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-400 text-center leading-relaxed"
        >
          {micError}
        </motion.div>
      )}

      {isConnected && (
        <button
          type="button"
          onClick={() => void disconnect()}
          className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Disconnect
        </button>
      )}

      {state === 'recording' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <AudioWaveform analyser={analyserNode} size="sm" color="rgb(239 68 68)" />
        </motion.div>
      )}

      <div className="relative">
        <AnimatePresence>
          {state === 'speaking' && (
            <>
              <motion.div
                className={`absolute inset-0 rounded-full ${colors.bg}`}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className={`absolute inset-0 rounded-full ${colors.bg}`}
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
            </>
          )}
        </AnimatePresence>

        <motion.button
          className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-2xl ${colors.bg} ring-1 ${colors.ring} transition-colors`}
          whileTap={{ scale: 0.92 }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-label={state === 'idle' ? 'Start voice input' : state === 'recording' ? 'Recording...' : 'AI speaking'}
        >
          {state === 'recording' ? (
            <MicOff className={`h-7 w-7 ${colors.icon}`} />
          ) : (
            <Mic className={`h-7 w-7 ${colors.icon}`} />
          )}
        </motion.button>
      </div>
    </div>
  );
}
