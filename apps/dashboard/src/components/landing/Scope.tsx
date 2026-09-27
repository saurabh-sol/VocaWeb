import { Check, X } from 'lucide-react';
import { Reveal } from '@/components/ui/motion';

const GOOD = [
  'Landing pages and launch pages',
  'Portfolios and personal sites',
  'Marketing sites with pricing and FAQ',
  'Menus, timetables and small shop fronts',
];

const NOT_YET = [
  'Logins, databases or a backend',
  'Real payments and checkout',
  'Native mobile apps',
  'Large dashboards with many screens',
];

/** Sets expectations honestly, laid out like two columns of a ledger. */
export function Scope() {
  return (
    <section id="scope" className="mx-auto max-w-[1240px] px-5 pb-20 md:px-6 lg:pb-28">
      <Reveal className="vw-card overflow-hidden">
        <div className="border-b-[1.5px] border-rule px-6 py-7 md:px-10 md:py-9">
          <h2 className="text-[clamp(28px,3.6vw,40px)] font-semibold leading-[1.08] tracking-[-0.03em]">
            What it builds, and what it does not
          </h2>
          <p className="mt-3 max-w-[60ch] text-[15.5px] text-dim">
            VocaWeb v1 writes plain HTML, CSS and JavaScript. That covers most sites people need,
            and it is better to know the edges before you start.
          </p>
        </div>

        <div className="grid md:grid-cols-2">
          <div className="px-6 py-7 md:px-10 md:py-9">
            <h3 className="font-mono text-[12px] uppercase tracking-[0.1em] text-ok">Builds well</h3>
            <ul className="mt-4 grid gap-3.5">
              {GOOD.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[15.5px]">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-ok text-paper">
                    <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t-[1.5px] border-dashed border-soft px-6 py-7 md:border-l-[1.5px] md:border-t-0 md:px-10 md:py-9">
            <h3 className="font-mono text-[12px] uppercase tracking-[0.1em] text-dim">Not yet</h3>
            <ul className="mt-4 grid gap-3.5">
              {NOT_YET.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[15.5px] text-dim">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-soft">
                    <X className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
