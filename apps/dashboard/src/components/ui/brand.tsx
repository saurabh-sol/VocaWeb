import Link from 'next/link';
import type { SimpleIcon } from 'simple-icons';
import { cn } from '@/lib/utils';

/** Ink tile with a mono "V" and a brand-coloured offset, the VocaWeb mark. */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.53) }}
      className={cn(
        'grid shrink-0 place-items-center rounded-lg border-[1.5px] border-ink bg-ink font-mono font-semibold leading-none text-paper shadow-[2px_2px_0_var(--vw-brand)]',
        className,
      )}
    >
      V
    </span>
  );
}

export function Brand({
  href = '/',
  className,
  onClick,
}: {
  href?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 font-display text-[19px] font-bold tracking-tight text-ink',
        className,
      )}
    >
      <BrandMark />
      VocaWeb
    </Link>
  );
}

/** Renders a Simple Icons glyph. Path data comes from the package, never drawn by hand. */
export function BrandIcon({
  icon,
  size = 18,
  colored = false,
  className,
}: {
  icon: SimpleIcon;
  size?: number;
  /** Use the brand's own colour instead of the current text colour. */
  colored?: boolean;
  className?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={colored ? `#${icon.hex}` : 'currentColor'}
      className={cn('shrink-0', className)}
    >
      <path d={icon.path} />
    </svg>
  );
}
