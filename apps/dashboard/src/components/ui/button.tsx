import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'brand' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'vw-btn-primary',
  secondary: '',
  brand: 'vw-btn-brand',
  ghost: 'vw-btn-ghost',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'vw-btn-sm',
  md: '',
  lg: 'vw-btn-lg',
  icon: 'vw-btn-icon',
};

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn('vw-btn', variantClass[variant], sizeClass[size], className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Force a full document load. Needed when entering /app so isolation headers apply. */
  hard?: boolean;
}

export function ButtonLink({
  href,
  variant,
  size,
  hard = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const classes = buttonClass(variant, size, className);
  if (hard || /^(https?:|mailto:|#)/.test(href)) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
