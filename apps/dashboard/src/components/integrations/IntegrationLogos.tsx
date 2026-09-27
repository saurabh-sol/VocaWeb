import Image from 'next/image';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BeamNode({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'z-10 flex size-12 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--card)] p-2 shadow-md',
        'sm:size-14',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function UserBeamNode({ className }: { className?: string }) {
  return (
    <BeamNode className={className}>
      <User className="size-6 text-[var(--foreground)] sm:size-7" strokeWidth={1.75} />
    </BeamNode>
  );
}

export function VocawebBeamNode({ className }: { className?: string }) {
  return (
    <BeamNode className={cn('size-14 border-[var(--primary)]/30 bg-[var(--primary)]/5 sm:size-16', className)}>
      <Image
        src="/vocaweb-icon.png"
        alt="VocaWeb"
        width={48}
        height={48}
        className="size-9 object-contain sm:size-10"
      />
    </BeamNode>
  );
}

export function FigmaLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/integrations/figma-logo.png"
      alt="Figma"
      width={56}
      height={56}
      className={cn('size-7 rounded-full object-cover sm:size-8', className)}
    />
  );
}

export function CanvaLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/integrations/canva-logo.png"
      alt="Canva"
      width={56}
      height={56}
      className={cn('size-7 rounded-full object-cover sm:size-8', className)}
    />
  );
}

export function NotionLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/integrations/notion-logo.png"
      alt="Notion"
      width={56}
      height={56}
      className={cn('size-7 rounded-full object-cover sm:size-8', className)}
    />
  );
}

export function FigmaBeamNode({ className }: { className?: string }) {
  return (
    <BeamNode className={cn('overflow-hidden p-0', className)}>
      <FigmaLogo className="size-full min-h-full min-w-full" />
    </BeamNode>
  );
}

export function CanvaBeamNode({ className }: { className?: string }) {
  return (
    <BeamNode className={cn('overflow-hidden p-0', className)}>
      <CanvaLogo className="size-full min-h-full min-w-full" />
    </BeamNode>
  );
}

export function NotionBeamNode({ className }: { className?: string }) {
  return (
    <BeamNode className={cn('overflow-hidden p-0', className)}>
      <NotionLogo className="size-full min-h-full min-w-full" />
    </BeamNode>
  );
}
