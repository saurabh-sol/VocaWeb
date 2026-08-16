import { fixProjectError } from './build-helper.js';

const AUTO_FIX_PATTERNS = [
  /Event handlers cannot be passed/i,
  /use client/i,
  /SharedArrayBuffer/i,
  /Module not found/i,
  /SyntaxError/i,
  /TypeError/i,
  /Cannot find module/i,
  /Hydration failed/i,
];

export function isAutoFixableError(error: string): boolean {
  return AUTO_FIX_PATTERNS.some((p) => p.test(error));
}

export async function autoFixBuildError(
  projectId: string,
  errorMessage: string,
  userId = 'anonymous',
  channel: 'chat' | 'voice' = 'chat',
  maxRetries = 3,
): Promise<{ fixed: boolean; files?: Record<string, string>; attempts: number }> {
  let lastError = errorMessage;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fixProjectError(projectId, lastError, userId, channel);
      if (result.applied > 0) {
        return { fixed: true, files: result.files, attempts: attempt };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { fixed: false, attempts: maxRetries };
}
