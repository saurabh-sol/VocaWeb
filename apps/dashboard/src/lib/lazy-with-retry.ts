type ModuleLoader<T> = () => Promise<T>;

/**
 * Retries dynamic imports once, then reloads the page on chunk load failures
 * (common after dev hot reload or a new production deploy).
 */
export function lazyWithRetry<T>(loader: ModuleLoader<T>): ModuleLoader<T> {
  return async () => {
    try {
      return await loader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isChunkError =
        (error instanceof Error && error.name === 'ChunkLoadError') ||
        message.includes('Loading chunk');

      if (isChunkError && typeof window !== 'undefined') {
        const retryKey = `chunk-retry:${message}`;
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, '1');
          window.location.reload();
          return new Promise(() => {});
        }
        sessionStorage.removeItem(retryKey);
      }

      throw error;
    }
  };
}
