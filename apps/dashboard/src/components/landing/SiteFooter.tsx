import Link from 'next/link';
import { Brand } from '@/components/ui/brand';
import { SIGN_IN_PATH } from '@/lib/routes';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#how', label: 'How it works' },
      { href: '#features', label: 'Features' },
      { href: '#scope', label: 'What it builds' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: SIGN_IN_PATH, label: 'Sign in' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t-[1.5px] border-rule bg-paper">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-12 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))] md:px-6">
        <div>
          <Brand />
          <p className="mt-4 max-w-[38ch] text-[14.5px] text-dim">
            Build websites by talking or typing. Plain code, a live preview and one click to
            publish.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-mono text-[12px] font-normal uppercase tracking-[0.1em] text-dim">
              {column.title}
            </h2>
            <ul className="mt-4 grid gap-2.5 text-[14.5px]">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith('#') ? (
                    <a href={link.href} className="hover:underline hover:underline-offset-4">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="hover:underline hover:underline-offset-4">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t-[1.5px] border-dashed border-soft">
        <p className="mx-auto max-w-[1240px] px-5 py-5 font-mono text-[12px] text-dim md:px-6">
          © {new Date().getFullYear()} VocaWeb. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
