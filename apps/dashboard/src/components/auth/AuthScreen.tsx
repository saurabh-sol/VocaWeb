'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { siGithub, siGoogle } from 'simple-icons';
import { Loader2 } from 'lucide-react';
import { Brand, BrandIcon } from '@/components/ui/brand';
import { Notice } from '@/components/ui/tag';
import { ThemeToggle } from '@/components/ThemeToggle';
import { APP_HOME, SIGN_IN_PATH, SIGN_UP_PATH, SSO_CALLBACK_PATH } from '@/lib/routes';
import { cn } from '@/lib/utils';

type Mode = 'sign-in' | 'sign-up';
type Strategy = 'oauth_google' | 'oauth_github';

const PROVIDERS: Array<{ strategy: Strategy; label: string; icon: typeof siGoogle; colored: boolean }> = [
  { strategy: 'oauth_google', label: 'Continue with Google', icon: siGoogle, colored: true },
  { strategy: 'oauth_github', label: 'Continue with GitHub', icon: siGithub, colored: false },
];

const COPY: Record<
  Mode,
  {
    title: string;
    body: string;
    switchText: string;
    switchLabel: string;
    switchHref: string;
    artTitle: string;
    artAccent: string;
    receiptTitle: string;
    receiptLines: string[];
    receiptTotal: string;
  }
> = {
  'sign-in': {
    title: 'Welcome back',
    body: 'Sign in to pick up your projects where you left them.',
    switchText: 'New to VocaWeb?',
    switchLabel: 'Create an account',
    switchHref: SIGN_UP_PATH,
    artTitle: 'Pick up where you',
    artAccent: 'stopped.',
    receiptTitle: 'Waiting for you',
    receiptLines: ['Your projects', 'Chat and voice history', 'Published sites', 'Connected sources'],
    receiptTotal: 'saved',
  },
  'sign-up': {
    title: 'Create your account',
    body: 'One click with Google or GitHub. No password to remember.',
    switchText: 'Already have an account?',
    switchLabel: 'Sign in',
    switchHref: SIGN_IN_PATH,
    artTitle: 'Say it. See it',
    artAccent: 'built.',
    receiptTitle: 'Your first build',
    receiptLines: ['Describe the site', 'Approve the plan', 'Watch the preview', 'Publish'],
    receiptTotal: 'free',
  },
};

const SLIDE = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const;
const EASE = [0.16, 1, 0.3, 1] as const;

/** Where to land after signing in. Only same-site /app paths are honoured. */
function resolveTarget(): string {
  const raw = new URLSearchParams(window.location.search).get('redirect_url');
  if (!raw) return APP_HOME;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith(APP_HOME)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    /* fall through to the default */
  }
  return APP_HOME;
}

/**
 * One screen for both routes. Sign in puts the form on the right, sign up puts it on the
 * left, and moving between them slides the two halves past each other.
 */
export function AuthScreen() {
  const pathname = usePathname();
  const mode: Mode = pathname.startsWith(SIGN_UP_PATH) ? 'sign-up' : 'sign-in';
  const copy = COPY[mode];
  const formOnRight = mode === 'sign-in';

  const { isLoaded, signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [pending, setPending] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The return path travels with the visitor when they switch between the two pages.
  const [query, setQuery] = useState('');

  useEffect(() => {
    setQuery(window.location.search);
  }, [pathname]);

  useEffect(() => {
    // A full load, so the builder gets its cross-origin isolation headers.
    if (isSignedIn) window.location.replace(resolveTarget());
  }, [isSignedIn]);

  useEffect(() => {
    setError(null);
  }, [mode]);

  const start = async (strategy: Strategy) => {
    if (!isLoaded || !signIn || pending) return;
    setError(null);
    setPending(strategy);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: SSO_CALLBACK_PATH,
        redirectUrlComplete: resolveTarget(),
      });
    } catch (err) {
      setPending(null);
      setError(
        isClerkAPIResponseError(err)
          ? (err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Sign in failed.')
          : 'Could not reach the sign-in service. Check your connection and try again.',
      );
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid min-h-[100dvh] overflow-hidden lg:grid-cols-2">
        {/* Form half */}
        <motion.div
          layout
          transition={SLIDE}
          className={cn(
            'relative z-10 flex flex-col bg-bg px-5 py-6 md:px-10',
            formOnRight ? 'lg:order-2' : 'lg:order-1',
          )}
          style={{
            backgroundImage: 'radial-gradient(var(--vw-dot) 0.9px, transparent 0.9px)',
            backgroundSize: '22px 22px',
          }}
        >
          <div className="flex items-center justify-between">
            <Brand />
            <ThemeToggle />
          </div>

          <main className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[400px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, x: formOnRight ? 28 : -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: formOnRight ? 28 : -28 }}
                  transition={{ duration: 0.28, ease: EASE }}
                >
                  <h1 className="text-[38px] font-semibold leading-[1.05] tracking-[-0.035em]">
                    {copy.title}
                  </h1>
                  <p className="mt-3 text-[15.5px] text-dim">{copy.body}</p>
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 grid gap-3">
                {PROVIDERS.map((provider) => {
                  const busy = pending === provider.strategy;
                  return (
                    <button
                      key={provider.strategy}
                      type="button"
                      onClick={() => void start(provider.strategy)}
                      disabled={!isLoaded || pending !== null}
                      aria-busy={busy || undefined}
                      className="vw-btn vw-btn-lg w-full justify-start gap-3"
                    >
                      {busy ? (
                        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                      ) : (
                        <BrandIcon icon={provider.icon} colored={provider.colored} />
                      )}
                      {provider.label}
                    </button>
                  );
                })}
              </div>

              {error && (
                <Notice tone="bad" className="mt-5" role="alert">
                  {error}
                </Notice>
              )}

              {/* Clerk mounts its bot check here when a new account needs one. */}
              <div id="clerk-captcha" className="mt-4" />

              <hr className="vw-divider my-7" />

              <p className="text-[14px] text-dim">
                {copy.switchText}{' '}
                <Link
                  href={`${copy.switchHref}${query}`}
                  className="font-semibold text-ink underline underline-offset-4"
                >
                  {copy.switchLabel}
                </Link>
              </p>
            </div>
          </main>
        </motion.div>

        {/* Printed half */}
        <motion.aside
          layout
          transition={SLIDE}
          aria-hidden
          className={cn(
            'relative hidden overflow-hidden border-x-[1.5px] border-rule bg-ink text-paper lg:block',
            formOnRight ? 'lg:order-1' : 'lg:order-2',
          )}
        >
          <span
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage: 'radial-gradient(var(--vw-paper) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="relative flex h-full flex-col justify-between gap-10 p-14">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="max-w-[13ch] font-display text-[clamp(40px,4.4vw,64px)] font-semibold leading-[1] tracking-[-0.04em]"
              >
                {copy.artTitle} <span className="text-brand">{copy.artAccent}</span>
              </motion.p>
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 24, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: formOnRight ? 2 : -2 }}
                exit={{ opacity: 0, y: 16, rotate: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className={cn(
                  'w-[280px] rounded-md border-[1.5px] border-paper bg-ink px-5 pb-5 pt-4 font-mono shadow-[6px_6px_0_var(--vw-brand)]',
                  formOnRight && 'self-end',
                )}
              >
                <div className="mb-2.5 flex justify-between border-b-[1.5px] border-dashed border-paper/60 pb-2 text-[10.5px] uppercase tracking-[0.08em] opacity-70">
                  <span>{copy.receiptTitle}</span>
                  <span>v1</span>
                </div>
                {copy.receiptLines.map((line) => (
                  <div
                    key={line}
                    className="flex justify-between border-b border-dotted border-paper/30 py-1.5 text-[12.5px]"
                  >
                    <span>{line}</span>
                    <span className="opacity-60">{mode === 'sign-in' ? 'kept' : 'included'}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t-[1.5px] border-dashed border-paper/60 pt-2.5 text-[13px] font-semibold">
                  <span>Total</span>
                  <span className="text-brand">{copy.receiptTotal}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      </div>
    </MotionConfig>
  );
}
