const PROMPTS = [
  'A booking page for my barbershop',
  'A one-page site for our wedding',
  'A menu site for a food truck',
  'A portfolio for a freelance illustrator',
  'A launch page for my podcast',
  'A landing page for a language tutor',
  'A pricing page for my SaaS',
  'A site for a neighbourhood yoga studio',
];

/** The page's single marquee: things people ask VocaWeb for. Pauses on hover. */
export function PromptTicker() {
  const loop = [...PROMPTS, ...PROMPTS];
  return (
    <div
      className="group flex h-[38px] items-center overflow-hidden border-y-[1.5px] border-rule bg-ink font-mono text-[12.5px] text-paper"
      aria-label="Example requests"
    >
      <span className="flex h-full shrink-0 items-center bg-brand px-4 font-semibold tracking-[0.06em] text-brand-ink">
        TRY SAYING
      </span>
      <div className="flex h-full flex-1 items-center overflow-hidden">
        <ul className="flex w-max animate-ticker gap-11 whitespace-nowrap pl-11 group-hover:[animation-play-state:paused]">
          {loop.map((prompt, i) => (
            <li key={i} aria-hidden={i >= PROMPTS.length} className="flex items-center gap-3">
              <span className="opacity-50" aria-hidden>
                /
              </span>
              {prompt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
