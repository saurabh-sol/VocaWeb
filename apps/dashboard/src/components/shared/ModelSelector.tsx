'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Lock } from 'lucide-react';
import { useAppStore, MODEL_TIERS, type ModelTier } from '@/store';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = MODEL_TIERS[selectedModel];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)]/40 bg-[var(--card)]/20 hover:bg-[var(--card)]/40 transition-colors text-xs font-medium"
      >
        <span className="text-[var(--foreground)]">{current.label}</span>
        <span className="text-[var(--muted-foreground)]">({current.tag})</span>
        <ChevronDown className={`w-3 h-3 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-[var(--border)]/40 bg-[var(--card)]/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden"
          >
            {(Object.entries(MODEL_TIERS) as [ModelTier, typeof MODEL_TIERS.v1][]).map(
              ([tier, info]) => {
                const isSelected = selectedModel === tier;
                const isLocked = tier === 'v2' || tier === 'v3';

                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setSelectedModel(tier);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-[var(--primary)]/10'
                        : 'hover:bg-[var(--muted)]/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {info.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          tier === 'v1'
                            ? 'bg-blue-500/15 text-blue-400'
                            : tier === 'v2'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-purple-500/15 text-purple-400'
                        }`}>
                          {info.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {tier === 'v1'
                          ? 'Free — HTML, CSS & JavaScript'
                          : `Hold ${info.tokensRequired.toLocaleString()} $DROOP`}
                      </p>
                    </div>
                    {isLocked && (
                      <Lock className="w-3.5 h-3.5 text-[var(--muted-foreground)]/50 shrink-0" />
                    )}
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                    )}
                  </button>
                );
              },
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
