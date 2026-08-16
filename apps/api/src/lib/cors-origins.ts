/** Normalize origin for CORS matching (no trailing slash). */
function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Vercel production + preview deploy URLs (e.g. testing-web-git-main-*.vercel.app). */
const VERCEL_APP_ORIGIN = /^https:\/\/[\w.-]+\.vercel\.app$/;

/** Static origins from env (production URL, localhost, extras). */
export function getAllowedOrigins(): string[] {
  const extra =
    process.env.CORS_ALLOWED_ORIGINS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const candidates = [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.DASHBOARD_URL,
    process.env.WEB_APP_URL,
    ...extra,
  ].filter(Boolean) as string[];

  return [...new Set(candidates.map(normalizeOrigin))];
}

/** Whether a browser Origin is allowed (static list + Vercel preview deploys). */
export function isOriginAllowed(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  if (getAllowedOrigins().includes(normalized)) return true;
  if (VERCEL_APP_ORIGIN.test(normalized)) return true;
  return false;
}
