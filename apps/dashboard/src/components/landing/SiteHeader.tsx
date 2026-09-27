'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Brand } from '@/components/ui/brand';
import { ButtonLink } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { APP_HOME, SIGN_IN_PATH } from '@/lib/routes';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#scope', label: 'What it builds' },
  { href: '#faq', label: 'FAQ' },
];

export function SiteHeader() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 });

  return (
    <header className="sticky top-0 z-40 border-b-[1.5px] border-rule bg-paper">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center gap-4 px-5 md:px-6">
        <Brand />

        <nav aria-label="Main" className="ml-3 hidden items-center gap-0.5 lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="vw-navlink">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />
        <div className="hidden items-center gap-2 sm:flex">
          {isSignedIn ? (
            <ButtonLink href={APP_HOME} hard variant="primary" size="sm">
              Open the app
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href={SIGN_IN_PATH} variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href={APP_HOME} hard variant="primary" size="sm">
                Start building
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="vw-btn vw-btn-icon lg:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Reading progress, drawn on the header's own rule. */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="absolute -bottom-[1.5px] left-0 h-[3px] w-full origin-left bg-brand"
      />

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t-[1.5px] border-dashed border-soft lg:hidden"
          >
            <div className="grid gap-1 px-5 py-4">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-wash"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 grid gap-2 sm:hidden">
                {isSignedIn ? (
                  <ButtonLink href={APP_HOME} hard variant="primary">
                    Open the app
                  </ButtonLink>
                ) : (
                  <>
                    <ButtonLink href={APP_HOME} hard variant="primary">
                      Start building
                    </ButtonLink>
                    <ButtonLink href={SIGN_IN_PATH}>Sign in</ButtonLink>
                  </>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
