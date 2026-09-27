'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useAppStore, MODEL_TIERS, type ModelTier } from '@/store';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = MODEL_TIERS[selectedModel];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-rule bg-paper px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-wash"
      >
        {current.label}
        <ChevronDown
          className={cn('h-3 w-3 text-dim transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            aria-label="Model"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 w-[268px] overflow-hidden rounded-[10px] border-[1.5px] border-rule bg-paper shadow-hard"
          >
            {(Object.entries(MODEL_TIERS) as [ModelTier, (typeof MODEL_TIERS)[ModelTier]][]).map(
              ([tier, info]) => {
                const selected = selectedModel === tier;
                return (
                  <li key={tier} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      disabled={!info.available}
                      onClick={() => {
                        setSelectedModel(tier);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 border-b border-dotted border-soft px-4 py-3 text-left transition-colors last:border-b-0',
                        info.available ? 'hover:bg-wash' : 'cursor-not-allowed opacity-55',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{info.label}</span>
                          <Tag tone={info.available ? 'brand' : 'neutral'}>
                            {info.available ? 'Free' : 'Soon'}
                          </Tag>
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-dim">{info.stack}</p>
                      </div>
                      {selected && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  </li>
                );
              },
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
