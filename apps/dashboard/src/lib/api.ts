'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  getToken?: GetTokenFn,
) {
  // Clerk refreshes its short-lived session token on its own, so the cached one is always valid.
  const token = getToken ? await getToken() : null;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

/** Turns an API error body into a sentence a person can read. */
export function describeApiError(
  body: { error?: string; message?: string } | null | undefined,
  fallback: string,
): string {
  if (!body) return fallback;
  if (body.error === 'limit_reached' || body.error === 'access_denied') {
    return body.message ?? fallback;
  }
  return body.error ?? body.message ?? fallback;
}

export { API_BASE };
