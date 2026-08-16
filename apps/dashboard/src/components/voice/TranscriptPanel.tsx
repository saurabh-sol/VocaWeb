'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from './VoiceProvider';

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--foreground)]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function TranscriptPanel() {
  const { transcript, isSpeaking, partialUserText, partialAssistantText } = useVoice();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, isSpeaking, partialUserText, partialAssistantText]);

  const hasContent = transcript.length > 0 || isSpeaking || !!partialUserText || !!partialAssistantText;
  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-28 right-8 z-40 w-80 max-h-96 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
    >
      <div className="border-b border-[var(--border)] px-4 py-2.5 bg-[var(--muted)]">
        <p className="text-xs font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Conversation</p>
      </div>

      <div ref={scrollRef} className="flex flex-col gap-2 overflow-y-auto p-3 max-h-80">
        <AnimatePresence initial={false}>
          {transcript.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {partialUserText && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end"
          >
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-[var(--primary)]/60 text-[var(--primary-foreground)] italic">
              {partialUserText}
            </div>
          </motion.div>
        )}

        {isSpeaking && partialAssistantText ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
              {partialAssistantText}
            </div>
          </motion.div>
        ) : isSpeaking ? (
          <TypingIndicator />
        ) : null}
      </div>
    </motion.div>
  );
}
