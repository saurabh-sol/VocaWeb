import { cn } from '@/lib/utils';

export type TagTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'ink' | 'brand';

const toneClass: Record<TagTone, string> = {
  neutral: '',
  ok: 'vw-tag-ok',
  warn: 'vw-tag-warn',
  bad: 'vw-tag-bad',
  ink: 'vw-tag-ink',
  brand: 'vw-tag-brand',
};

export function Tag({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: TagTone }) {
  return <span className={cn('vw-tag', toneClass[tone], className)} {...props} />;
}

export function Kicker({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('vw-kicker', className)} {...props} />;
}

export type NoticeTone = 'info' | 'ok' | 'warn' | 'bad';

const noticeClass: Record<NoticeTone, string> = {
  info: '',
  ok: 'vw-notice-ok',
  warn: 'vw-notice-warn',
  bad: 'vw-notice-bad',
};

export function Notice({
  tone = 'info',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: NoticeTone }) {
  return <div className={cn('vw-notice', noticeClass[tone], className)} {...props} />;
}
