'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Gauge, Globe, Layers, LogOut, Monitor, Moon, Sun, User, UserCog } from 'lucide-react';
import { IntegrationsSettingsPanel } from '@/components/integrations/IntegrationsSettingsPanel';
import { Button } from '@/components/ui/button';
import { CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { Notice } from '@/components/ui/tag';
import { apiFetch } from '@/lib/api';
import { useAuthSession } from '@/lib/auth';
import { getDeployBaseDomain } from '@/lib/deploy-domain';
import { cn } from '@/lib/utils';

type SettingsTab = 'account' | 'usage' | 'integrations' | 'appearance';

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'usage', label: 'Usage', icon: Gauge },
  { id: 'integrations', label: 'Integrations', icon: Layers },
  { id: 'appearance', label: 'Appearance', icon: Moon },
];

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
] as const;

interface Usage {
  plan: string;
  buildsToday: number;
  dailyLimit: number;
  resetsAt: string;
}

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="vw-card p-6"
    >
      {children}
    </motion.section>
  );
}

function AccountTab() {
  const { user, isLoaded, signOut } = useAuthSession();
  const { openUserProfile } = useClerk();

  if (!isLoaded || !user) {
    return (
      <Section>
        <div className="flex items-center gap-5" aria-busy="true">
          <Skeleton className="h-16 w-16 rounded-[10px]" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </Section>
    );
  }

  return (
    <>
      <Section>
        <CardHeader title="Profile" description="Your details come from the account you signed in with." />
        <div className="mt-6 flex items-center gap-5">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-16 w-16 rounded-[10px] border-[1.5px] border-rule object-cover shadow-hard-sm"
            />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-[10px] border-[1.5px] border-rule bg-wash font-display text-2xl font-semibold shadow-hard-sm">
              {user.initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-[19px] font-semibold">{user.name}</p>
            <p className="truncate font-mono text-[12.5px] text-dim">{user.email}</p>
          </div>
        </div>
        <hr className="vw-divider my-6" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => openUserProfile()}>
            <UserCog className="h-4 w-4" aria-hidden />
            Manage account
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </Section>

      <Section delay={0.05}>
        <CardHeader
          title="Publishing"
          description="Every project gets its own address the first time you publish it."
        />
        <div className="mt-5 flex items-center gap-3 rounded-lg border-[1.5px] border-rule bg-wash px-3.5 py-3">
          <Globe className="h-4 w-4 shrink-0 text-dim" aria-hidden />
          <span className="min-w-0 truncate font-mono text-[13px]">
            your-site.{getDeployBaseDomain()}
          </span>
        </div>
        <p className="vw-help mt-3">
          Choose the name in the sandbox under Publish. Publishing again updates the same address.
        </p>
      </Section>
    </>
  );
}

function UsageTab() {
  const { getToken, isSignedIn } = useAuthSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSignedIn) return;
    setError(null);
    try {
      const res = await apiFetch('/billing/usage', {}, getToken);
      if (!res.ok) throw new Error('bad status');
      setUsage((await res.json()) as Usage);
    } catch {
      setError('Usage could not be loaded. Check that the API is running.');
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const used = usage ? Math.min(usage.buildsToday, usage.dailyLimit) : 0;
  const left = usage ? Math.max(0, usage.dailyLimit - usage.buildsToday) : 0;

  return (
    <Section>
      <CardHeader
        title="Usage"
        description="VocaWeb v1 is free. A daily allowance keeps builds fast for everyone."
      />

      {error ? (
        <Notice tone="bad" role="alert" className="mt-5 flex items-center justify-between gap-3">
          <span>{error}</span>
          <Button size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </Notice>
      ) : !usage ? (
        <div className="mt-6 grid gap-3" aria-busy="true">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="mt-6">
          <p className="font-display text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {left}
            <span className="ml-2 text-[15px] font-normal tracking-normal text-dim">
              of {usage.dailyLimit} builds left today
            </span>
          </p>
          <div
            className="mt-5 flex gap-[3px]"
            role="img"
            aria-label={`${used} of ${usage.dailyLimit} builds used today`}
          >
            {Array.from({ length: usage.dailyLimit }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-3 flex-1 rounded-[2px] border',
                  i < used ? 'border-ink bg-ink' : 'border-soft',
                )}
              />
            ))}
          </div>
          <p className="vw-help mt-4">
            Builds and AI edits count. Chatting and planning do not. The allowance resets at{' '}
            {new Date(usage.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>
      )}
    </Section>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Section>
      <CardHeader title="Appearance" description="Pick a theme, or follow your device." />
      <div role="radiogroup" aria-label="Theme" className="mt-6 grid grid-cols-3 gap-3">
        {THEMES.map((option) => {
          const active = mounted && theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.id)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-[10px] border-[1.5px] p-5 transition-[border-color,box-shadow,transform,background-color] duration-150',
                active
                  ? 'border-rule bg-wash shadow-hard'
                  : 'border-soft hover:-translate-x-px hover:-translate-y-px hover:border-rule hover:shadow-hard-sm',
              )}
            >
              <option.icon className="h-6 w-6" aria-hidden />
              <span className="text-sm font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('account');

  useEffect(() => {
    // Coming back from an integration's consent screen lands on the integrations tab.
    if (new URLSearchParams(window.location.search).has('integration')) {
      setTab('integrations');
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-12">
      <h1 className="text-[clamp(30px,4vw,42px)] font-semibold leading-[1.05] tracking-[-0.035em]">
        Settings
      </h1>
      <p className="mt-2 text-[15.5px] text-dim">Your account, usage and preferences.</p>

      <div className="mt-8 grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
          className="flex gap-1 overflow-x-auto md:flex-col"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              data-active={tab === item.id}
              onClick={() => setTab(item.id)}
              className="vw-navlink shrink-0 !justify-start !rounded-lg md:w-full"
            >
              <item.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid content-start gap-6">
          {tab === 'account' && <AccountTab />}
          {tab === 'usage' && <UsageTab />}
          {tab === 'integrations' && <IntegrationsSettingsPanel />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}
