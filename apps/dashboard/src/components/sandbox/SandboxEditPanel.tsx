'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, MousePointer2, X, Crosshair } from 'lucide-react';
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
    <div className="flex flex-col h-full border-l border-[var(--border)]/30 bg-[#0d0d0d]/95">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--foreground)]">Edit with AI</span>
        </div>
        <button
          type="button"
          onClick={onToggleInspect}
          disabled={disabled}
          title={inspectMode ? 'Exit select mode' : 'Select element in preview'}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-40 ${
            inspectMode
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
              : 'border border-[var(--border)]/40 text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          {inspectMode ? <Crosshair className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
          {inspectMode ? 'Selecting…' : 'Select'}
        </button>
      </div>

      {/* Selected element */}
      <div className="px-3 py-2.5 border-b border-[var(--border)]/20">
        {selectedElement ? (
          <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-2.5 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[var(--primary)] mb-0.5">
                  Selected
                </p>
                <p className="text-xs font-mono text-[var(--foreground)] truncate">
                  &lt;{selectedElement.tagName}&gt;
                  {selectedElement.className
                    ? `.${selectedElement.className.split(/\s+/).slice(0, 2).join('.')}`
                    : ''}
                </p>
                {selectedElement.text && (
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1 line-clamp-2">
                    “{selectedElement.text}”
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClearSelection}
                className="p-0.5 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Click <strong className="text-[var(--foreground)]">Select</strong>, then click any
            element in the Live preview to target your edit.
          </p>
        )}
      </div>

      {/* Chat thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && !editStatus && (
          <p className="text-[11px] text-[var(--muted-foreground)] text-center py-6">
            Describe a change — AI will update your site and refresh the preview.
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs leading-relaxed rounded-lg px-2.5 py-2 ${
                msg.role === 'user'
                  ? 'bg-[var(--muted)]/40 text-[var(--foreground)] ml-2'
                  : 'bg-[var(--primary)]/10 text-[var(--foreground)] mr-2'
              }`}
            >
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {editStatus && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)] px-1">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--primary)] shrink-0" />
            ) : null}
            <span>{editStatus}</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border)]/30 p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => appendPrompt(chip)}
              disabled={disabled || isLoading}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-[var(--border)]/40 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/40 transition-colors disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            rows={3}
            placeholder={
              selectedElement
                ? `Change this ${selectedElement.tagName}…`
                : 'Add instructions for your site…'
            }
            className="w-full resize-none rounded-lg border border-[var(--border)]/40 bg-[var(--muted)]/30 px-3 py-2 pr-10 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isLoading || !input.trim()}
            className="absolute bottom-2 right-2 p-1.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-40 transition-opacity"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Enter to apply · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
