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
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <FileCode className="w-10 h-10 text-[var(--muted-foreground)]/50" />
        <p className="text-sm text-[var(--muted-foreground)]">
          Select a file to view its code
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]/30">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <span className="text-xs font-medium text-[var(--foreground)] truncate max-w-[300px]">
            {filePath}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {lineCount} lines
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/40 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-auto text-[13px] leading-5">
        <Highlight theme={themes.nightOwl} code={content} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="p-4 min-w-fit">
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line });
                return (
                  <div key={i} {...lineProps} className="table-row">
                    <span className="table-cell pr-4 text-right select-none text-[var(--muted-foreground)]/40 text-[11px] w-[3ch]">
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
