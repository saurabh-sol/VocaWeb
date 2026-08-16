'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null>;

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  getToken?: GetTokenFn,
) {
  const token = getToken ? await getToken({ skipCache: true }) : null;

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

export { API_BASE };
