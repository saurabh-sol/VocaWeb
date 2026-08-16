'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn(
          'h-9 w-9 rounded-full border border-[var(--border)] bg-[var(--muted)]/30',
          className,
        )}
        aria-hidden
      />
    );
  }

  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={setTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50',
        className,
      )}
    />
  );
}
