'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Magnetic, RisingWords } from '@/components/ui/motion';
import { APP_HOME } from '@/lib/routes';
import { LiveBuildDemo } from './LiveBuildDemo';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();

  const fade = (delay: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 16 } as const),
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  });

  return (
    <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-24 pt-12 md:px-6 lg:min-h-[calc(100dvh-60px-34px)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16 lg:pb-28 lg:pt-10">
      <div>
        <motion.span {...fade(0)} className="vw-kicker block">
          AI website builder
        </motion.span>

        <h1 className="mt-4 text-[clamp(46px,7.2vw,92px)] font-semibold leading-[0.98] tracking-[-0.045em]">
          <RisingWords text="Say it." delay={0.08} className="block" />
          <RisingWords text="See it built." accent={['built']} delay={0.26} className="block" />
        </h1>

        <motion.p
          {...fade(0.5)}
          className="mt-6 max-w-[500px] text-[18px] leading-[1.6] text-dim"
        >
          Describe your site in chat or out loud. VocaWeb plans it, writes the code and publishes
          it live.
        </motion.p>

        <motion.div {...fade(0.62)} className="mt-8 flex flex-wrap items-center gap-3">
          <Magnetic>
            <ButtonLink href={APP_HOME} hard variant="primary" size="lg" className="group">
              Start building
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>
          </Magnetic>
          <ButtonLink href="#how" size="lg">
            See how it works
          </ButtonLink>
        </motion.div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, rotate: 1.2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
        className="lg:pl-10"
      >
        <LiveBuildDemo />
      </motion.div>
    </section>
  );
}
