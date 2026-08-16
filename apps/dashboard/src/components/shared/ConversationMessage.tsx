'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ConversationMessageProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  className?: string;
}

export function ConversationMessage({ role, children, className = '' }: ConversationMessageProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${className}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--primary)] text-[var(--primary-foreground)] rounded-br-sm'
            : 'bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] rounded-bl-sm'
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}
