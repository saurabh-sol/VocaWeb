'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Code2, FolderOpen, History, Settings, Sparkles } from 'lucide-react';
import { useAppStore, type AgentMode } from '@/store';
import { Brand } from '@/components/ui/brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { VoiceProvider } from '@/components/voice/VoiceProvider';
import { useConversationSync } from '@/hooks/useConversationSync';
import { APP_HISTORY, APP_HOME, APP_SETTINGS } from '@/lib/routes';

const ISOLATION_RETRY_KEY = 'vocaweb:isolation-reload';

/**
 * The sandbox needs a cross-origin isolated page. Arriving here through a client-side
 * navigation keeps the previous page's headers, so reload once to pick up the right ones.
 */
function useCrossOriginIsolation() {
  useEffect(() => {
    if (window.crossOriginIsolated) {
      sessionStorage.removeItem(ISOLATION_RETRY_KEY);
      return;
    }
    if (sessionStorage.getItem(ISOLATION_RETRY_KEY)) return;
    sessionStorage.setItem(ISOLATION_RETRY_KEY, '1');
    window.location.reload();
  }, []);
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Code2;
  /** Items on the builder page switch a mode instead of changing the route. */
  mode?: AgentMode;
}

const NAV: NavItem[] = [
  { label: 'Build', href: APP_HOME, icon: Sparkles, mode: 'chat' },
  { label: 'Projects', href: APP_HOME, icon: FolderOpen, mode: 'projects' },
  { label: 'Sandbox', href: APP_HOME, icon: Code2, mode: 'sandbox' },
  { label: 'History', href: APP_HISTORY, icon: History },
  { label: 'Settings', href: APP_SETTINGS, icon: Settings },
];

function AppNav() {
  const pathname = usePathname();
  const agentMode = useAppStore((s) => s.agentMode);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const hasProject = useAppStore((s) => Object.keys(s.projectFiles).length > 0);

  return (
    <>
      {NAV.map((item) => {
        const onBuilder = pathname === APP_HOME;
        const active = item.mode
          ? onBuilder &&
            (item.mode === 'chat'
              ? agentMode === 'chat' || agentMode === 'planning'
              : agentMode === item.mode)
          : pathname === item.href;
        const disabled = item.mode === 'sandbox' && !hasProject;

        return (
          <Link
            key={item.label}
            href={item.href}
            data-active={active}
            aria-current={active ? 'page' : undefined}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : undefined}
            title={disabled ? 'Build a site first to open the sandbox' : undefined}
            onClick={(event) => {
              if (disabled) {
                event.preventDefault();
                return;
              }
              if (item.mode) setAgentMode(item.mode);
              else if (agentMode === 'sandbox') setAgentMode('projects');
            }}
            className="vw-navlink shrink-0"
          >
            <item.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useCrossOriginIsolation();
  useConversationSync();

  return (
    <VoiceProvider>
      <div className="flex min-h-[100dvh] flex-col">
        <header className="sticky top-0 z-40 border-b-[1.5px] border-rule bg-paper">
          <div className="mx-auto flex h-[60px] max-w-[1400px] items-center gap-4 px-4 md:px-6">
            <Brand href={APP_HOME} />
            <nav aria-label="App" className="ml-3 hidden items-center gap-0.5 md:flex">
              <AppNav />
            </nav>
            <div className="flex-1" />
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    'h-9 w-9 rounded-lg border-[1.5px] border-rule shadow-hard-sm',
                },
              }}
            />
          </div>
          <nav
            aria-label="App"
            className="flex items-center gap-0.5 overflow-x-auto border-t-[1.5px] border-dashed border-soft px-3 py-1.5 md:hidden"
          >
            <AppNav />
          </nav>
        </header>

        <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </VoiceProvider>
  );
}
