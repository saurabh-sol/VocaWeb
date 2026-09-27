import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('vw-skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'vw-card-dashed px-5 text-center',
        compact ? 'py-9' : 'py-14',
        className,
      )}
    >
      {icon && (
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-rule bg-wash text-ink">
          {icon}
        </div>
      )}
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {children && (
        <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] text-dim">{children}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

/** Two or three mutually exclusive choices in one bordered control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex gap-[3px] rounded-lg border-[1.5px] border-rule bg-paper p-[3px]',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition-colors',
            value === option.value
              ? 'bg-ink text-paper'
              : 'text-dim hover:bg-wash hover:text-ink',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
