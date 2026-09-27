import { cn } from '@/lib/utils';

export type CardTone = 'raised' | 'flat' | 'soft' | 'dashed';

const toneClass: Record<CardTone, string> = {
  raised: 'vw-card',
  flat: 'vw-card-flat',
  soft: 'vw-card-soft',
  dashed: 'vw-card-dashed',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

export function Card({ tone = 'raised', className, ...props }: CardProps) {
  return <div className={cn(toneClass[tone], className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13.5px] text-dim">{description}</p>}
      </div>
      {action}
    </div>
  );
}
