'use client';

import { useEffect, useRef, useCallback } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  size?: 'sm' | 'lg';
  color?: string;
  barCount?: number;
}

export function AudioWaveform({
  analyser,
  size = 'lg',
  color = 'currentColor',
  barCount,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);

  const count = barCount ?? (size === 'sm' ? 12 : 24);
  const dimensions = size === 'sm' ? { w: 80, h: 32 } : { w: 200, h: 48 };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.w;
    const h = dimensions.h;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    if (barsRef.current.length !== count) {
      barsRef.current = new Array(count).fill(0);
    }

    let targetBars: number[];

    if (analyser) {
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      const binSize = Math.floor(freqData.length / count);
      targetBars = [];
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let j = 0; j < binSize; j++) {
          sum += freqData[i * binSize + j];
        }
        targetBars.push((sum / binSize) / 255);
      }
    } else {
      targetBars = new Array(count).fill(0);
    }

    const smoothing = 0.25;
    for (let i = 0; i < count; i++) {
      barsRef.current[i] += (targetBars[i] - barsRef.current[i]) * smoothing;
    }

    const gap = size === 'sm' ? 2 : 3;
    const barWidth = (w - gap * (count - 1)) / count;
    const minHeight = size === 'sm' ? 2 : 3;
    const radius = barWidth / 2;

    for (let i = 0; i < count; i++) {
      const barH = Math.max(minHeight, barsRef.current[i] * h * 0.9);
      const x = i * (barWidth + gap);
      const y = (h - barH) / 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, radius);
      ctx.fillStyle = color;
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [analyser, count, dimensions.w, dimensions.h, size, color]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: dimensions.w,
        height: dimensions.h,
      }}
      className="pointer-events-none"
    />
  );
}
