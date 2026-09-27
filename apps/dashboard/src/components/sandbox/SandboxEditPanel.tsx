'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, MousePointer2, X, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SelectedElementInfo } from '@/lib/vocaweb-inspect-bridge';

export interface SandboxChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const QUICK_PROMPTS = [
  '/modern',
  '/contrast',
  '/spacious',
  '/simplify',
  '/readable',
  '/pop',
];

interface SandboxEditPanelProps {
  selectedElement: SelectedElementInfo | null;
  inspectMode: boolean;
  onToggleInspect: () => void;
  onClearSelection: () => void;
  messages: SandboxChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  editStatus: string | null;
  disabled?: boolean;
}

export function SandboxEditPanel({
  selectedElement,
  inspectMode,
  onToggleInspect,
  onClearSelection,
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  editStatus,
  disabled,
}: SandboxEditPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, editStatus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const appendPrompt = (chip: string) => {
    const next = input.trim() ? `${input.trim()} ${chip}` : chip;
    onInputChange(next);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full flex-col bg-paper">
      {/* Header */}
      <div className="flex items-center justify-between border-b-[1.5px] border-rule px-3 py-2.5">
        <span className="vw-kicker text-ink">Edit with AI</span>
        <button
          type="button"
          onClick={onToggleInspect}
          disabled={disabled}
          aria-pressed={inspectMode}
          title={inspectMode ? 'Stop selecting' : 'Select an element in the preview'}
          className={cn(
            'flex items-center gap-1.5 rounded-md border-[1.5px] px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40',
            inspectMode
              ? 'border-brand bg-brand text-brand-ink'
              : 'border-rule text-ink hover:bg-wash',
          )}
        >
          {inspectMode ? (
            <Crosshair className="h-3 w-3" aria-hidden />
          ) : (
            <MousePointer2 className="h-3 w-3" aria-hidden />
          )}
          {inspectMode ? 'Selecting' : 'Select'}
        </button>
      </div>

      {/* Selected element */}
      <div className="border-b-[1.5px] border-dashed border-soft px-3 py-2.5">
        {selectedElement ? (
          <div className="rounded-lg border-[1.5px] border-dashed border-brand px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="vw-kicker mb-0.5 text-[10px] text-brand">Selected</p>
                <p className="truncate font-mono text-xs">
                  &lt;{selectedElement.tagName}&gt;
                  {selectedElement.className
                    ? `.${selectedElement.className.split(/\s+/).slice(0, 2).join('.')}`
                    : ''}
                </p>
                {selectedElement.text && (
                  <p className="mt-1 line-clamp-2 text-[11.5px] text-dim">
                    {selectedElement.text}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Clear selection"
                className="rounded p-0.5 text-dim hover:bg-wash hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] leading-relaxed text-dim">
            Press <strong className="text-ink">Select</strong>, then click any element in the
            preview to aim your edit at it.
          </p>
        )}
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !editStatus && (
          <p className="py-6 text-center text-[11.5px] text-dim">
            Describe a change. VocaWeb updates the site and refreshes the preview.
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-lg border-[1.5px] px-2.5 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'ml-4 border-rule bg-ink text-paper'
                  : 'mr-4 border-soft bg-wash',
              )}
            >
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {editStatus && (
          <div className="flex items-center gap-2 px-1 font-mono text-[11px] text-dim" role="status">
            {isLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
            <span>{editStatus}</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="space-y-2 border-t-[1.5px] border-rule p-3">
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => appendPrompt(chip)}
              disabled={disabled || isLoading}
              className="rounded border border-soft px-1.5 py-0.5 font-mono text-[10.5px] text-dim transition-colors hover:border-rule hover:text-ink disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="relative">
          <label htmlFor="sandbox-edit-input" className="sr-only">
            Edit instructions
          </label>
          <textarea
            id="sandbox-edit-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            rows={3}
            placeholder={
              selectedElement
                ? `Change this ${selectedElement.tagName}`
                : 'Describe a change to your site'
            }
            className="vw-input resize-none pr-11 text-[12.5px]"
          />
          <Button
            variant="primary"
            size="icon"
            onClick={onSubmit}
            disabled={disabled || isLoading || !input.trim()}
            aria-label="Apply the edit"
            className="absolute bottom-2.5 right-2 !h-7 !w-7 !shadow-none"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        </div>
        <p className="font-mono text-[10.5px] text-faint">Enter to apply, Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
