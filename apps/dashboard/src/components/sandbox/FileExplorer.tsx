'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
  FileJson,
  FileType,
  Palette,
  Settings,
  FolderOpen,
  Folder,
} from 'lucide-react';

interface FileExplorerProps {
  files: Record<string, string>;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
    case 'ts':
    case 'jsx':
    case 'js':
      return <FileCode className="h-4 w-4 shrink-0 text-brand" aria-hidden />;
    case 'json':
      return <FileJson className="h-4 w-4 shrink-0 text-warn" aria-hidden />;
    case 'css':
      return <Palette className="h-4 w-4 shrink-0 text-ok" aria-hidden />;
    case 'md':
      return <FileText className="h-4 w-4 shrink-0 text-dim" aria-hidden />;
    case 'mjs':
    case 'cjs':
      return <Settings className="h-4 w-4 shrink-0 text-dim" aria-hidden />;
    default:
      return <FileType className="h-4 w-4 shrink-0 text-dim" aria-hidden />;
  }
}

function buildTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const filePath of filePaths.sort()) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join('/');

      let existing = current.find((n) => n.name === name);
      if (!existing) {
        existing = {
          name,
          path: fullPath,
          isFolder: !isLast,
          children: [],
        };
        current.push(existing);
      }
      current = existing.children;
    }
  }

  return root;
}

function TreeItem({
  node,
  depth,
  activeFile,
  onFileSelect,
  defaultOpen,
}: {
  node: TreeNode;
  depth: number;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isActive = node.path === activeFile;

  if (node.isFolder) {
    return (
      <div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-wash"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-dim" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-dim" aria-hidden />
          )}
          {isOpen ? (
            <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Folder className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {node.children.map((child) => (
                <TreeItem
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  activeFile={activeFile}
                  onFileSelect={onFileSelect}
                  defaultOpen={depth < 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onFileSelect(node.path)}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
        isActive ? 'bg-ink text-paper [&_svg]:text-paper' : 'text-dim hover:bg-wash hover:text-ink'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileExplorer({ files, activeFile, onFileSelect }: FileExplorerProps) {
  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  const fileCount = Object.keys(files).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-[1.5px] border-rule px-3 py-2.5">
        <span className="vw-kicker text-ink">Files</span>
        <span className="font-mono text-[10.5px] text-dim">{fileCount}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1.5">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            defaultOpen={true}
          />
        ))}
      </div>
    </div>
  );
}
