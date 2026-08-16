'use client';

interface StaticWaveformProps {
  seed?: string;
  barCount?: number;
  className?: string;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function StaticWaveform({ seed = '', barCount = 12, className = '' }: StaticWaveformProps) {
  const base = hashSeed(seed || 'wave');
  const heights = Array.from({ length: barCount }, (_, i) => {
    const v = ((base + i * 7919) % 100) / 100;
    return 20 + v * 80;
  });

  return (
    <div className={`flex items-center gap-0.5 h-5 px-1 ${className}`}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-0.5 bg-current rounded-full opacity-70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
