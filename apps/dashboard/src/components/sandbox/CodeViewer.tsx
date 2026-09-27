'use client';

import { useMemo } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { FileCode, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface CodeViewerProps {
  filePath: string | null;
  content: string;
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
      return 'tsx';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'markup';
    case 'md':
      return 'markdown';
    default:
      return 'typescript';
  }
}

export function CodeViewer({ filePath, content }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const language = useMemo(() => (filePath ? getLanguage(filePath) : 'typescript'), [filePath]);
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!filePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <FileCode className="h-10 w-10 text-faint" aria-hidden />
        <p className="text-sm text-dim">Select a file to read its code</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-soft px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden />
          <span className="max-w-[300px] truncate font-mono text-xs font-medium">{filePath}</span>
          <span className="shrink-0 font-mono text-[10.5px] text-dim">{lineCount} lines</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy the code"
          title="Copy the code"
          className="rounded-md p-1.5 text-dim transition-colors hover:bg-wash hover:text-ink"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-ok" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>
      {/* Code keeps a dark surface in both themes so syntax colours stay readable. */}
      <div className="flex-1 overflow-auto bg-[var(--vw-code-bg)] font-mono text-[13px] leading-5 text-[var(--vw-code-ink)]">
        <Highlight theme={themes.nightOwl} code={content} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="min-w-fit p-4">
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line });
                return (
                  <div key={i} {...lineProps} className="table-row">
                    <span className="table-cell w-[3ch] select-none pr-4 text-right text-[11px] opacity-35">
                      {i + 1}
                    </span>
                    <span className="table-cell">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
