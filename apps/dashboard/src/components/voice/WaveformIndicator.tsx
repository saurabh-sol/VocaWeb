'use client';

import { motion } from 'framer-motion';

interface WaveformIndicatorProps {
  barCount?: number;
  className?: string;
}

export function WaveformIndicator({ barCount = 5, className = '' }: WaveformIndicatorProps) {
  return (
    <div className={`flex items-center gap-1 h-6 px-1 ${className}`}>
      {Array.from({ length: barCount }, (_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-current rounded-full"
          animate={{ height: ['20%', '100%', '20%'] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </div>
  );
}
