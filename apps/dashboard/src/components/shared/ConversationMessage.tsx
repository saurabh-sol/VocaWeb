'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ConversationMessageProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  className?: string;
}

export function ConversationMessage({ role, children, className }: ConversationMessageProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start', className)}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-[10px] border-[1.5px] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm border-rule bg-ink text-paper'
            : 'rounded-bl-sm border-soft bg-wash text-ink',
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
