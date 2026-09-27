'use client';

import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Magnetic, Reveal } from '@/components/ui/motion';
import { APP_HOME } from '@/lib/routes';

/** Closing band, printed in ink like the ticker above. */
export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-20 md:px-6 lg:pb-28">
      <Reveal className="relative overflow-hidden rounded-[10px] border-[1.5px] border-rule bg-ink px-6 py-14 text-paper shadow-[6px_6px_0_var(--vw-brand)] md:px-14 md:py-20">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: 'radial-gradient(var(--vw-paper) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-[14ch] text-[clamp(36px,5.6vw,72px)] font-semibold leading-[0.98] tracking-[-0.045em]">
            Your site is one sentence away.
          </h2>
          <Magnetic>
            <ButtonLink
              href={APP_HOME}
              hard
              size="lg"
              className="group !border-paper !bg-paper !text-ink !shadow-[3px_3px_0_var(--vw-brand)]"
            >
              Start building
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>
          </Magnetic>
        </div>
      </Reveal>
    </section>
  );
}
