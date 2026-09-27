'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatedThemeToggler } from '@/registry/magicui/animated-theme-toggler';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

const shell =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-rule bg-paper text-ink';

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn(shell, className)} aria-hidden />;
  }

  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={setTheme}
      duration={520}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className={cn(
        shell,
        'shadow-hard-sm transition-[transform,box-shadow] duration-100 hover:translate-x-px hover:translate-y-px hover:shadow-none active:translate-x-0.5 active:translate-y-0.5',
        className,
      )}
    />
  );
}
