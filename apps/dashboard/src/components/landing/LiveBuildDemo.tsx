'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Check, Mic, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEMO_SITES, demoShell } from './demo-sites';

const FRAME_WIDTH = 1200;
const FRAME_HEIGHT = 760;

type Phase = 'typing' | 'planning' | 'building' | 'ready';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-5 items-center gap-[3px]" aria-hidden>
      {[0.5, 0.9, 0.65, 1, 0.55, 0.8, 0.45].map((peak, i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] origin-center rounded-full bg-brand',
            active ? 'animate-[vw-wave_0.9s_ease-in-out_infinite]' : 'scale-y-[0.25]',
          )}
          style={{
            height: '100%',
            animationDelay: `${i * 90}ms`,
            ['--peak' as string]: peak,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The hero demo. It types a request, then writes a real sample site into a live preview
 * frame one block at a time. Nothing here is a screenshot: the frame renders the HTML.
 */
export function LiveBuildDemo() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const frameReady = useRef<(() => void) | null>(null);
  const inView = useInView(rootRef, { amount: 0.25 });
  const inViewRef = useRef(inView);
  inViewRef.current = inView;

  const [siteIndex, setSiteIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [typed, setTyped] = useState(0);
  const [written, setWritten] = useState(0);
  const [styled, setStyled] = useState(false);
  const [phase, setPhase] = useState<Phase>('typing');
  const autoRef = useRef(true);

  const site = DEMO_SITES[siteIndex];

  // Keep the 1200px-wide frame scaled to whatever width the card has.
  useEffect(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame) return;
    const fit = () => {
      frame.style.transform = `scale(${stage.clientWidth / FRAME_WIDTH})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [run, siteIndex]);

  useEffect(() => {
    let cancelled = false;
    const current = DEMO_SITES[siteIndex];

    const frameLoaded = new Promise<void>((resolve) => {
      frameReady.current = resolve;
      const doc = frameRef.current?.contentDocument;
      if (doc?.readyState === 'complete' && doc.getElementById('site-css')) resolve();
    });

    const write = (index: number) => {
      const doc = frameRef.current?.contentDocument;
      doc?.body.insertAdjacentHTML('beforeend', current.sections[index].html);
    };
    const applyStyles = () => {
      const style = frameRef.current?.contentDocument?.getElementById('site-css');
      style?.setAttribute('media', 'all');
    };
    const scrollFrame = (toEnd: boolean) => {
      const win = frameRef.current?.contentWindow;
      const doc = frameRef.current?.contentDocument;
      if (!win || !doc) return;
      win.scrollTo({
        top: toEnd ? doc.documentElement.scrollHeight : 0,
        behavior: reduce ? 'auto' : 'smooth',
      });
    };

    (async () => {
      setTyped(0);
      setWritten(0);
      setStyled(false);
      setPhase('typing');
      await frameLoaded;
      if (cancelled) return;

      if (reduce) {
        current.sections.forEach((_, i) => write(i));
        applyStyles();
        setTyped(current.prompt.length);
        setWritten(current.sections.length);
        setStyled(true);
        setPhase('ready');
        return;
      }

      // Hold the first frame until the demo is actually on screen.
      while (!inViewRef.current) {
        await sleep(250);
        if (cancelled) return;
      }

      if (current.mode === 'voice') {
        const words = current.prompt.split(' ');
        let length = 0;
        for (const word of words) {
          length += word.length + 1;
          setTyped(Math.min(length, current.prompt.length));
          await sleep(170);
          if (cancelled) return;
        }
      } else {
        for (let i = 1; i <= current.prompt.length; i++) {
          setTyped(i);
          await sleep(26);
          if (cancelled) return;
        }
      }

      setPhase('planning');
      await sleep(850);
      if (cancelled) return;

      setPhase('building');
      for (let i = 0; i < current.sections.length; i++) {
        write(i);
        setWritten(i + 1);
        if (i === 0) {
          // The markup lands bare first, then the stylesheet arrives.
          await sleep(620);
          if (cancelled) return;
          applyStyles();
          setStyled(true);
        } else {
          scrollFrame(true);
        }
        await sleep(1250);
        if (cancelled) return;
      }

      setPhase('ready');
      await sleep(900);
      if (cancelled) return;
      scrollFrame(false);
      await sleep(3600);
      if (cancelled) return;

      while (!inViewRef.current) {
        await sleep(400);
        if (cancelled) return;
      }
      if (autoRef.current) {
        setSiteIndex((index) => (index + 1) % DEMO_SITES.length);
        setRun((value) => value + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [siteIndex, run, reduce]);

  const pick = useCallback((index: number) => {
    autoRef.current = false;
    setSiteIndex(index);
    setRun((value) => value + 1);
  }, []);

  const status =
    phase === 'typing'
      ? site.mode === 'voice'
        ? 'Listening'
        : 'Reading'
      : phase === 'planning'
        ? 'Planning'
        : phase === 'building'
          ? site.sections[Math.max(0, written - 1)].log
          : 'Preview ready';

  const PromptIcon = site.mode === 'voice' ? Mic : Type;

  return (
    <div ref={rootRef} className="relative">
      <div className="vw-card overflow-hidden shadow-hard-lg">
        <div className="flex items-center gap-3 border-b-[1.5px] border-rule px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border-[1.5px] border-rule bg-wash">
            <PromptIcon className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-h-[1.5em] min-w-0 flex-1 truncate text-[14px] font-medium" aria-live="off">
            {site.prompt.slice(0, typed)}
            {phase === 'typing' && (
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-caret bg-brand" />
            )}
          </p>
          {site.mode === 'voice' && <Waveform active={phase === 'typing'} />}
        </div>

        <div
          ref={stageRef}
          className="relative overflow-hidden bg-white"
          style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_HEIGHT}` }}
        >
          <iframe
            key={`${site.id}-${run}`}
            ref={frameRef}
            title={`Sample site being built: ${site.label}`}
            srcDoc={demoShell(site)}
            sandbox="allow-same-origin"
            tabIndex={-1}
            onLoad={() => frameReady.current?.()}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
            style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-rule px-3 py-2.5">
          <span className="truncate font-mono text-[11.5px] text-dim lg:pl-[188px]" role="status">
            {status}
          </span>
          <div
            role="group"
            aria-label="Choose a sample site"
            className="flex shrink-0 gap-[3px] rounded-lg border-[1.5px] border-rule p-[3px]"
          >
            {DEMO_SITES.map((option, index) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={index === siteIndex}
                onClick={() => pick(index)}
                className={cn(
                  'rounded-[5px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors',
                  index === siteIndex ? 'bg-ink text-paper' : 'text-dim hover:bg-wash hover:text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Build log, shaped like a till receipt. */}
      <div
        className={cn(
          'z-10 w-[236px] rounded-md border-[1.5px] border-rule bg-paper px-4 pb-5 pt-4 font-mono shadow-hard-lg',
          'max-lg:mx-auto max-lg:mt-6',
          'lg:absolute lg:-bottom-16 lg:-left-14 lg:-rotate-2',
        )}
      >
        <div className="mb-2.5 flex justify-between border-b-[1.5px] border-dashed border-rule pb-2 text-[10.5px] uppercase tracking-[0.08em] text-dim">
          <span>Build log</span>
          <span>{site.label}</span>
        </div>
        <ReceiptRow label="index.html" done={written > 0}>
          {written} of {site.sections.length} blocks
        </ReceiptRow>
        <ReceiptRow label="styles.css" done={styled}>
          {styled ? 'applied' : 'waiting'}
        </ReceiptRow>
        <div className="mt-2 flex items-center justify-between border-t-[1.5px] border-dashed border-rule pt-2.5 text-[12.5px] font-semibold">
          <span>{phase === 'ready' ? 'Ready' : 'Building'}</span>
          <span className={phase === 'ready' ? 'text-ok' : 'text-dim'}>
            {phase === 'ready' ? 'preview live' : 'in progress'}
          </span>
        </div>
        <p className="mt-3 text-center text-[10px] tracking-wide text-faint">
          demo build with sample content
        </p>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  done,
  children,
}: {
  label: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-dotted border-soft py-1.5 text-[12px]">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            'grid h-3.5 w-3.5 place-items-center rounded-[3px] border transition-colors duration-200',
            done ? 'border-ok bg-ok text-paper' : 'border-soft text-transparent',
          )}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />
        </span>
        {label}
      </span>
      <span className={done ? 'text-ink' : 'text-faint'}>{children}</span>
    </div>
  );
}
