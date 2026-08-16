'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { FolderOpen, MessageSquare, Code2, Settings, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useAppStore, useHydrated, type AgentMode } from '@/store';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useConversationSync } from '@/hooks/useConversationSync';
import { OnboardingGate } from '@/components/dashboard/OnboardingGate';

const navItems = [
  { href: '/', label: 'Projects', icon: FolderOpen },
  { href: '/chat-history', label: 'Chat History', icon: MessageSquare },
  { href: '/', label: 'Sandbox', icon: Code2, isSandbox: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function DashboardNav({
  pathname,
  agentMode,
  setAgentMode,
  onNavigate,
}: {
  pathname: string;
  agentMode: string;
  setAgentMode: (mode: AgentMode) => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const isSandboxItem = 'isSandbox' in item && item.isSandbox;
        const isProjectsItem = item.href === '/' && !isSandboxItem;
        const isActive = isSandboxItem
          ? pathname === '/' && agentMode === 'sandbox'
          : isProjectsItem
            ? pathname === '/' && agentMode === 'projects'
            : pathname === item.href;

        if (isSandboxItem) {
          const projectFiles = useAppStore.getState().projectFiles;
          const hasProject = Object.keys(projectFiles).length > 0;
          return (
            <Link
              key="sandbox"
              href={item.href}
              onClick={(e) => {
                if (!hasProject) {
                  e.preventDefault();
                  return;
                }
                setAgentMode('sandbox');
                onNavigate?.();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-md backdrop-blur-md'
                  : hasProject
                    ? 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]/40 cursor-not-allowed pointer-events-none'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        }

        if (isProjectsItem) {
          return (
            <Link
              key="projects"
              href={item.href}
              onClick={() => {
                setAgentMode('projects');
                onNavigate?.();
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-md backdrop-blur-md'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (agentMode === 'sandbox') {
                setAgentMode('projects');
              }
              onNavigate?.();
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
              isActive
                ? 'bg-[var(--primary)]/90 text-[var(--primary-foreground)] shadow-md backdrop-blur-md'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]'
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const agentMode = useAppStore((s) => s.agentMode);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { authenticated, user, logout } = usePrivy();
  const hydrated = useHydrated();
  const username = useAppStore((s) => s.username);
  const walletConnected = authenticated && !!user?.wallet?.address;

  useConversationSync();

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex min-h-screen relative overflow-hidden bg-[var(--background)]">
      <div className="absolute inset-0 z-0">
        <img
          src="/dashboard-bg.png"
          alt="Dashboard Background"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--background-top)]/88 via-[var(--brand-sky-mid)]/72 to-[var(--background-bottom)]/88 backdrop-blur-[1px]" />
      </div>

      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)]/30 bg-[var(--card)]/20 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-[var(--foreground)] hover:bg-[var(--muted)]/40"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="font-serif text-xl font-bold tracking-tight text-[var(--foreground)]">
          Vocaweb.
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-8 w-8" />
          {authenticated && (
            <button
              onClick={logout}
              className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--muted)]/20 hover:bg-[var(--muted)] flex items-center justify-center transition-colors"
              title={user?.email?.address || user?.wallet?.address || 'Account'}
            >
              <span className="text-xs font-semibold uppercase">
                {user?.email?.address?.[0] || user?.wallet?.address?.[0] || 'U'}
              </span>
            </button>
          )}
          {!authenticated && (
            <div className="w-8" aria-hidden />
          )}
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobile}
            aria-label="Close menu"
          />
          <aside className="relative flex h-full w-[min(100%,280px)] flex-col border-r border-[var(--border)]/30 bg-[var(--card)]/95 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--border)]/30">
              <Link href="/" className="font-serif text-xl font-bold tracking-tight" onClick={closeMobile}>
                Vocaweb.
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                className="rounded-lg p-2 hover:bg-[var(--muted)]/40"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <DashboardNav
              pathname={pathname}
              agentMode={agentMode}
              setAgentMode={setAgentMode}
              onNavigate={closeMobile}
            />
            {authenticated && (
              <div className="px-3 py-4 border-t border-[var(--border)]/30">
                <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--muted)]/40 rounded-lg transition-colors" onClick={logout}>
                  <div className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-center">
                    <span className="text-xs font-semibold uppercase">
                      {user?.email?.address?.[0] || user?.wallet?.address?.[0] || 'U'}
                    </span>
                  </div>
                  <span className="text-sm text-[var(--muted-foreground)]">Sign out</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <aside className="relative z-10 hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--border)]/30 bg-[var(--card)]/10 backdrop-blur-md">
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-[var(--foreground)] drop-shadow-sm">
            Vocaweb.
          </Link>
        </div>
        <DashboardNav pathname={pathname} agentMode={agentMode} setAgentMode={setAgentMode} />
        <div className="px-3 py-3 border-t border-[var(--border)]/30">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-[var(--muted-foreground)]">Theme</span>
            <ThemeToggle />
          </div>
        </div>
        {authenticated && (
          <div className="px-3 py-4 border-t border-[var(--border)]/30">
            <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--muted)]/40 rounded-lg transition-colors" onClick={logout}>
              <div className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-center">
                <span className="text-xs font-semibold uppercase">
                  {user?.email?.address?.[0] || user?.wallet?.address?.[0] || 'U'}
                </span>
              </div>
              <span className="text-sm text-[var(--muted-foreground)]">Sign out</span>
            </div>
          </div>
        )}
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden p-8 max-md:p-4 max-md:pt-[4.5rem] min-w-0">
        {hydrated && (!walletConnected || !username) ? (
          <OnboardingGate>{children}</OnboardingGate>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
