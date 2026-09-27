'use client';

import { useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { Check, Copy, Globe, Mic, Rocket, Send } from 'lucide-react';
import { Tag } from '@/components/ui/tag';
import { getDeployBaseDomain } from '@/lib/deploy-domain';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    id: 'describe',
    title: 'Describe it',
    body: 'Type a sentence or press the mic and talk. Mention the pages, the mood and anything you already know.',
  },
  {
    id: 'plan',
    title: 'Approve the plan',
    body: 'VocaWeb answers with a build plan: sections, layout and tone. Change anything before code is written.',
  },
  {
    id: 'publish',
    title: 'Publish it',
    body: 'Watch the preview come together, click any element to change it, then put it on a live address.',
  },
] as const;

function DescribePanel() {
  return (
    <div className="vw-card p-5 shadow-hard-lg">
      <div className="grid gap-3">
        <p className="ml-auto max-w-[85%] rounded-[10px] rounded-br-sm border-[1.5px] border-rule bg-ink px-4 py-3 text-[14px] text-paper">
          I run a yoga studio. I need a calm site with our classes and how to find us.
        </p>
        <p className="mr-auto max-w-[85%] rounded-[10px] rounded-bl-sm border-[1.5px] border-soft bg-wash px-4 py-3 text-[14px]">
          Got it. Do you want the weekly timetable on the home page, or on its own page?
        </p>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <div className="vw-input flex-1 text-faint">On the home page, under the intro</div>
        <span className="grid h-[42px] w-[42px] place-items-center rounded-lg border-[1.5px] border-rule bg-paper">
          <Mic className="h-4 w-4" />
        </span>
        <span className="grid h-[42px] w-[42px] place-items-center rounded-lg border-[1.5px] border-rule bg-ink text-paper">
          <Send className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function PlanPanel() {
  const lines = [
    'One page: intro, timetable, teachers, find us',
    'Soft palette of sage, sand and off-white',
    'Weekly timetable as a simple grid',
    'Map link and opening hours in the footer',
  ];
  return (
    <div className="vw-card overflow-hidden shadow-hard-lg">
      <div className="flex items-center justify-between border-b-[1.5px] border-rule bg-wash px-5 py-3">
        <span className="vw-kicker text-ink">Build plan</span>
        <Tag tone="warn">Waiting for you</Tag>
      </div>
      <ul className="grid gap-3 px-5 py-5">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-3 text-[14.5px]">
            <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-[1.5px] border-rule">
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            {line}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t-[1.5px] border-dashed border-soft px-5 py-4">
        <span className="vw-btn vw-btn-primary vw-btn-sm">
          <Rocket className="h-3.5 w-3.5" />
          Build this
        </span>
        <span className="vw-btn vw-btn-sm">Change plan</span>
      </div>
    </div>
  );
}

function PublishPanel() {
  const domain = `sage-studio.${getDeployBaseDomain()}`;
  return (
    <div className="vw-card p-5 shadow-hard-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-semibold">Published to the web</h3>
        <Tag tone="ok">Live</Tag>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg border-[1.5px] border-rule bg-wash px-3.5 py-3">
        <Globe className="h-4 w-4 shrink-0 text-dim" />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{domain}</span>
        <Copy className="h-4 w-4 shrink-0 text-dim" />
      </div>
      <hr className="vw-divider my-4" />
      <p className="text-[13.5px] text-dim">
        Edit the site again whenever you like, then update the same address.
      </p>
    </div>
  );
}

const PANELS = [DescribePanel, PlanPanel, PublishPanel];

function SectionHeading() {
  return (
    <h2 className="text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.035em]">
      From a sentence to a live site
    </h2>
  );
}

/** Plain stacked version: small screens and anyone who asked for less motion. */
function Stacked({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto max-w-[1240px] px-5 py-20 md:px-6', className)}>
      <SectionHeading />
      <ol className="mt-10 grid gap-12">
        {STEPS.map((step, i) => {
          const Panel = PANELS[i];
          return (
            <li key={step.id} className="grid gap-5">
              <div>
                <h3 className="text-[24px] font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[52ch] text-[15.5px] text-dim">{step.body}</p>
              </div>
              <div aria-hidden>
                <Panel />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function HowItWorks() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const rail = useTransform(scrollYProgress, [0, 1], [0.04, 1]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.min(STEPS.length - 1, Math.floor(value * STEPS.length));
    setActive((current) => (current === next ? current : next));
  });

  if (reduce) {
    return (
      <section id="how">
        <Stacked />
      </section>
    );
  }

  const Panel = PANELS[active];

  return (
    <section id="how">
      <Stacked className="lg:hidden" />

      {/* The section is three screens tall; the content pins while the steps advance. */}
      <div ref={ref} className="relative hidden h-[270vh] lg:block">
        <div className="sticky top-[60px] flex h-[calc(100dvh-60px)] items-center">
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-20 px-6">
            <div>
              <SectionHeading />
              <ol className="relative mt-10 grid gap-2 pl-7">
                <span
                  aria-hidden
                  className="absolute bottom-3 left-[5px] top-3 w-[3px] rounded-full bg-soft"
                />
                <motion.span
                  aria-hidden
                  style={{ scaleY: rail }}
                  className="absolute bottom-3 left-[5px] top-3 w-[3px] origin-top rounded-full bg-brand"
                />
                {STEPS.map((step, i) => (
                  <li
                    key={step.id}
                    aria-current={i === active ? 'step' : undefined}
                    className={cn(
                      'rounded-[10px] px-4 py-4 transition-[opacity,background-color] duration-300',
                      i === active ? 'bg-paper opacity-100' : 'opacity-45',
                    )}
                  >
                    <h3 className="text-[24px] font-semibold">{step.title}</h3>
                    <p className="mt-1.5 max-w-[46ch] text-[15.5px] text-dim">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div aria-hidden className="relative min-h-[340px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 24, rotate: 1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, y: -18, rotate: -1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Panel />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
