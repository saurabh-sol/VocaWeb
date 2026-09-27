'use client';

import Image from 'next/image';
import { siFigma, siNotion } from 'simple-icons';
import { MousePointer2 } from 'lucide-react';
import { BrandIcon } from '@/components/ui/brand';
import { Reveal, SpotlightCard } from '@/components/ui/motion';

/** Bar heights for the voice cell, shaped like a spoken phrase rather than random noise. */
const WAVE = Array.from({ length: 46 }, (_, i) => {
  const phrase = Math.sin((i / 45) * Math.PI);
  const syllable = 0.5 + 0.5 * Math.sin(i * 1.7) * Math.cos(i * 0.45);
  return Math.max(0.16, Math.min(1, 0.2 + phrase * syllable * 0.95));
});

function VoiceCell() {
  return (
    <SpotlightCard className="flex h-full min-h-[300px] flex-col justify-between overflow-hidden !bg-brand p-7 text-brand-ink">
      <div className="flex h-24 items-center justify-between" aria-hidden>
        {WAVE.map((peak, i) => (
          <span
            key={i}
            className="h-full w-[5px] origin-center animate-[vw-wave_1.5s_ease-in-out_infinite] rounded-full bg-brand-ink"
            style={{ ['--peak' as string]: peak, animationDelay: `${i * 45}ms` }}
          />
        ))}
      </div>
      <div>
        <h3 className="text-[28px] font-semibold leading-tight">Talk it through</h3>
        <p className="mt-2 max-w-[44ch] text-[15.5px] opacity-85">
          Voice mode is a conversation. Interrupt, change your mind and keep going while the site
          takes shape.
        </p>
      </div>
    </SpotlightCard>
  );
}

function ClickToEditCell() {
  return (
    <SpotlightCard className="flex h-full min-h-[300px] flex-col justify-between gap-6 p-7">
      <div className="flex flex-col items-start gap-5 rounded-lg bg-wash p-5" aria-hidden>
        <span className="relative rounded-[3px] px-1.5 font-display text-[22px] font-semibold outline-dashed outline-[1.5px] outline-offset-2 outline-brand">
          Fresh daily
          <MousePointer2 className="absolute -bottom-4 -right-3 h-5 w-5 fill-ink text-paper" />
        </span>
        <span className="vw-pill text-[11.5px]">Make this bolder</span>
      </div>
      <div>
        <h3 className="text-[22px] font-semibold leading-tight">Click, then say the change</h3>
        <p className="mt-2 text-[14.5px] text-dim">
          Pick any element in the preview and describe what should be different.
        </p>
      </div>
    </SpotlightCard>
  );
}

function CodeCell() {
  return (
    <SpotlightCard className="flex h-full min-h-[300px] flex-col justify-between overflow-hidden">
      <pre
        aria-hidden
        className="m-0 overflow-hidden border-b-[1.5px] border-rule bg-[var(--vw-code-bg)] px-6 py-5 font-mono text-[12.5px] leading-[1.75] text-[var(--vw-code-ink)]"
      >
        <code>
          <span className="opacity-50">{'<!-- index.html -->'}</span>
          {'\n'}
          <span className="text-[#7f95ff]">{'<section'}</span>
          <span className="text-[#4ad6a0]">{' class'}</span>
          {'="hero"'}
          <span className="text-[#7f95ff]">{'>'}</span>
          {'\n  '}
          <span className="text-[#7f95ff]">{'<h1>'}</span>
          {'Bread worth the early alarm.'}
          <span className="text-[#7f95ff]">{'</h1>'}</span>
          {'\n  '}
          <span className="text-[#7f95ff]">{'<a'}</span>
          <span className="text-[#4ad6a0]">{' href'}</span>
          {'="#menu"'}
          <span className="text-[#7f95ff]">{'>'}</span>
          {'See the menu'}
          <span className="text-[#7f95ff]">{'</a>'}</span>
          {'\n'}
          <span className="text-[#7f95ff]">{'</section>'}</span>
        </code>
      </pre>
      <div className="p-7">
        <h3 className="text-[22px] font-semibold leading-tight">Every file, in the open</h3>
        <p className="mt-2 max-w-[46ch] text-[14.5px] text-dim">
          Browse the HTML, CSS and JavaScript next to the live preview. Nothing is hidden.
        </p>
      </div>
    </SpotlightCard>
  );
}

function ImportCell() {
  const tile =
    'grid h-16 w-16 place-items-center rounded-[10px] border-[1.5px] border-rule bg-white text-[#101010] shadow-hard-sm';
  return (
    <SpotlightCard className="flex h-full min-h-[300px] flex-col justify-between gap-6 p-7">
      <div className="flex items-center gap-4">
        <span className={tile}>
          <BrandIcon icon={siNotion} size={30} />
        </span>
        <span className={tile}>
          <BrandIcon icon={siFigma} size={28} colored />
        </span>
        <span className={`${tile} overflow-hidden`}>
          <Image
            src="/integrations/canva-logo.png"
            alt="Canva"
            width={64}
            height={64}
            className="h-full w-full scale-125 object-contain"
          />
        </span>
      </div>
      <div>
        <h3 className="text-[22px] font-semibold leading-tight">Start from what you have</h3>
        <p className="mt-2 max-w-[46ch] text-[14.5px] text-dim">
          Connect Notion, Figma or Canva and turn a page or a design into the first build plan.
        </p>
      </div>
    </SpotlightCard>
  );
}

export function FeatureBento() {
  return (
    <section id="features" className="mx-auto max-w-[1240px] px-5 py-20 md:px-6 lg:py-28">
      <Reveal>
        <span className="vw-kicker">Inside the builder</span>
        <h2 className="mt-3 max-w-[16ch] text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.035em]">
          Built for people who would rather explain than code
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 lg:grid-cols-6">
        <Reveal className="lg:col-span-4">
          <VoiceCell />
        </Reveal>
        <Reveal className="lg:col-span-2" delay={0.08}>
          <ClickToEditCell />
        </Reveal>
        <Reveal className="lg:col-span-3">
          <CodeCell />
        </Reveal>
        <Reveal className="lg:col-span-3" delay={0.08}>
          <ImportCell />
        </Reveal>
      </div>
    </section>
  );
}
