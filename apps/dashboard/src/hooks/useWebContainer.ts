'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebContainer, FileSystemTree } from '@webcontainer/api';
import { SCAFFOLD_FILES } from '@/lib/scaffold-template';

export type WCStatus =
  | 'idle'
  | 'booting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

let globalInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let prewarmed = false;

export function toFileSystemTree(
  flatFiles: Record<string, string>,
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [filePath, contents] of Object.entries(flatFiles)) {
    const parts = filePath.split('/');
    let current: FileSystemTree = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = { file: { contents } };
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        const node = current[part];
        if ('directory' in node) {
          current = node.directory;
        }
      }
    }
  }

  return tree;
}

async function bootOnce(): Promise<WebContainer> {
  if (globalInstance) return globalInstance;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
      const reloadKey = 'theo-coep-reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        throw new Error('Enabling live preview environment...');
      }
      throw new Error(
        'Live preview requires a secure browser context. Please hard-refresh this page (Cmd+Shift+R).',
      );
    }

    const { WebContainer: WC } = await import('@webcontainer/api');
    const instance = await WC.boot({ coep: 'credentialless' });
    globalInstance = instance;
    return instance;
  })();

  return bootPromise;
}

/** Pre-boot WebContainer with scaffold shell (call on dashboard mount) */
export async function prewarmWebContainer(
  onLog?: (line: string) => void,
): Promise<void> {
  if (prewarmed || typeof window === 'undefined') return;
  try {
    const wc = await bootOnce();
    const tree = toFileSystemTree(SCAFFOLD_FILES);
    await wc.mount(tree);
    onLog?.('Scaffold mounted.');
    const installProcess = await wc.spawn('npm', ['install']);
    installProcess.output.pipeTo(
      new WritableStream({ write: (d) => onLog?.(d) }),
    );
    const exit = await installProcess.exit;
    if (exit === 0) {
      prewarmed = true;
      onLog?.('WebContainer pre-warmed.');
    }
  } catch {
    /* non-fatal */
  }
}

export function useWebContainer() {
  const [status, setStatus] = useState<WCStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const instanceRef = useRef<WebContainer | null>(globalInstance);
  const serverProcessRef = useRef<{ kill: () => void } | null>(null);
  const mountedRef = useRef(false);
  const lastFilesKeyRef = useRef('');

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > 500 ? next.slice(-300) : next;
    });
  }, []);

  const killRunningServer = useCallback(async () => {
    if (serverProcessRef.current) {
      serverProcessRef.current.kill();
      serverProcessRef.current = null;
    }
  }, []);

  const startDevServer = useCallback(
    async (wc: WebContainer) => {
      setStatus('starting');
      appendLog('Starting dev server...');

      const devProcess = await wc.spawn('npm', ['run', 'dev']);
      serverProcessRef.current = devProcess;

      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            appendLog(data);
          },
        }),
      );

      wc.on('server-ready', (_port, url) => {
        appendLog(`Dev server ready at ${url}`);
        setPreviewUrl(url);
        setStatus('ready');
      });
    },
    [appendLog],
  );

  const mountAndRun = useCallback(
    async (files: Record<string, string>, forceRemount = false) => {
      const filesKey = Object.keys(files).sort().join('|') + Object.values(files).join('').length;
      if (!forceRemount && filesKey === lastFilesKeyRef.current && status === 'ready') {
        return;
      }
      lastFilesKeyRef.current = filesKey;

      try {
        setError(null);

        if (!instanceRef.current) {
          setStatus('booting');
          appendLog('Booting WebContainer...');
          const inst = await bootOnce();
          instanceRef.current = inst;
          appendLog('WebContainer booted.');
        }

        const wc = instanceRef.current;

        if (mountedRef.current && previewUrl && !forceRemount) {
          appendLog('Applying file updates...');
          for (const [path, content] of Object.entries(files)) {
            try {
              await wc.fs.writeFile(path, content);
            } catch {
              /* path may not exist yet */
            }
          }
          return;
        }

        setPreviewUrl(null);
        await killRunningServer();

        setStatus('installing');
        appendLog('Mounting project files...');
        const tree = toFileSystemTree(files);
        await wc.mount(tree);
        mountedRef.current = true;

        const pkgContent = files['package.json'] ?? '';
        const isViteProject = pkgContent.includes('"vite"');
        if (prewarmed && isViteProject) {
          appendLog('Using pre-warmed environment.');
          await startDevServer(wc);
          return;
        }

        appendLog('Running npm install...');
        const installProcess = await wc.spawn('npm', ['install']);

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendLog(data);
            },
          }),
        );

        const installExit = await installProcess.exit;
        if (installExit !== 0) {
          setStatus('error');
          setError(`npm install failed with exit code ${installExit}`);
          appendLog(`npm install failed (exit code ${installExit})`);
          return;
        }

        appendLog('npm install complete.');
        await startDevServer(wc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        setStatus('error');
        setError(message);
        appendLog(`Error: ${message}`);
      }
    },
    [appendLog, killRunningServer, previewUrl, startDevServer, status],
  );

  const applyFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!instanceRef.current || !mountedRef.current) {
        await mountAndRun(files);
        return;
      }
      appendLog('Hot-applying files...');
      for (const [path, content] of Object.entries(files)) {
        try {
          await instanceRef.current.fs.writeFile(path, content);
        } catch {
          /* ignore */
        }
      }
      lastFilesKeyRef.current =
        Object.keys(files).sort().join('|') + Object.values(files).join('').length;
    },
    [appendLog, mountAndRun],
  );

  const updateFile = useCallback(
    async (path: string, content: string) => {
      if (!instanceRef.current || !mountedRef.current) return;
      await instanceRef.current.fs.writeFile(path, content);
    },
    [],
  );

  const resetPreview = useCallback(() => {
    lastFilesKeyRef.current = '';
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      killRunningServer();
    };
  }, [killRunningServer]);

  return {
    status,
    previewUrl,
    logs,
    error,
    mountAndRun,
    applyFiles,
    updateFile,
    resetPreview,
  };
}
