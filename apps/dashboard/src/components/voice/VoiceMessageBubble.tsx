'use client';

import { motion } from 'framer-motion';
import { ConversationMessage } from '@/components/shared/ConversationMessage';
import { AudioWaveform } from './AudioWaveform';
import { StaticWaveform } from './StaticWaveform';
import { WaveformIndicator } from './WaveformIndicator';

interface VoiceMessageBubbleProps {
  role: 'user' | 'assistant';
  text?: string;
  variant: 'live' | 'completed' | 'streaming';
  analyser?: AnalyserNode | null;
  showCursor?: boolean;
}

export function VoiceMessageBubble({
  role,
  text,
  variant,
  analyser,
  showCursor,
}: VoiceMessageBubbleProps) {
  const isUser = role === 'user';
  const waveColor = isUser ? 'currentColor' : 'currentColor';

  return (
    <ConversationMessage role={role}>
      <div className="flex flex-col gap-2">
        {variant === 'live' && isUser && analyser && (
          <AudioWaveform analyser={analyser} size="sm" color={waveColor} barCount={16} />
        )}
        {variant === 'live' && !isUser && <WaveformIndicator barCount={6} />}
        {variant === 'streaming' && !isUser && <WaveformIndicator barCount={6} />}
        {variant === 'completed' && (
          <StaticWaveform seed={text ?? role} barCount={isUser ? 14 : 12} />
        )}
        {text && (
          <p className={`leading-relaxed ${variant === 'live' && isUser ? 'italic opacity-90' : ''}`}>
            {text}
            {showCursor && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-0.5 h-4 bg-current ml-1 align-middle"
              />
            )}
          </p>
        )}
        {variant === 'streaming' && !text && (
          <div className="flex items-center gap-1.5 py-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-current opacity-50"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
      </div>
    </ConversationMessage>
  );
}
