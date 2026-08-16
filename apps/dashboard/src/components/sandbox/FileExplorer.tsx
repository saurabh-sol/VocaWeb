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
      return <FileCode className="w-4 h-4 text-blue-400" />;
    case 'json':
      return <FileJson className="w-4 h-4 text-yellow-400" />;
    case 'css':
      return <Palette className="w-4 h-4 text-purple-400" />;
    case 'md':
      return <FileText className="w-4 h-4 text-gray-400" />;
    case 'mjs':
    case 'cjs':
      return <Settings className="w-4 h-4 text-gray-400" />;
    default:
      return <FileType className="w-4 h-4 text-[var(--muted-foreground)]" />;
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
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-[var(--muted)]/40 rounded-md transition-colors group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-[var(--foreground)] truncate">{node.name}</span>
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
      onClick={() => onFileSelect(node.path)}
      className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded-md transition-all ${
        isActive
          ? 'bg-[var(--primary)]/20 text-[var(--primary-foreground)]'
          : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]'
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
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-[var(--border)]/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Explorer
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {fileCount} files
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
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
