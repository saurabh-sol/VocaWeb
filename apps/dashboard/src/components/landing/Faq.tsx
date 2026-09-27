'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Reveal } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

const ITEMS = [
  {
    q: 'Do I need to know how to code?',
    a: 'No. You describe the site and VocaWeb writes it. The code stays visible if you are curious, and you never have to touch it.',
  },
  {
    q: 'How do I sign in?',
    a: 'With your Google or GitHub account. There is no password to create and nothing else to connect.',
  },
  {
    q: 'What does it cost?',
    a: 'VocaWeb v1 is free to use. Each account has a daily build allowance so the service stays fast for everyone.',
  },
  {
    q: 'Is voice mode really live?',
    a: 'Yes. It listens and answers while you speak, so you can interrupt or change direction in the middle of a sentence.',
  },
  {
    q: 'Can I change one part of the site?',
    a: 'Open the preview, click the element and say what should change. Only that part is edited.',
  },
  {
    q: 'What happens to my projects?',
    a: 'They are saved to your account with their chat history. Open any project later and carry on where you stopped.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-[1240px] px-5 pb-20 md:px-6 lg:pb-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <Reveal>
          <h2 className="text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.035em]">
            Questions people ask first
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="vw-card divide-y-[1.5px] divide-dashed divide-soft overflow-hidden">
            {ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left font-display text-[17px] font-semibold transition-colors hover:bg-wash"
                    >
                      {item.q}
                      <span
                        className={cn(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-md border-[1.5px] border-rule transition-[transform,background-color,color] duration-300',
                          isOpen && 'rotate-45 bg-ink text-paper',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                      </span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[62ch] px-6 pb-6 text-[15px] leading-[1.65] text-dim">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
