export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Normalize a deploy URL for display (fix double https, ensure single protocol). */
export function normalizePublishUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  let value = url.trim();
  value = value.replace(/^https:\/\/https:\/\//i, 'https://');
  value = value.replace(/^http:\/\/https:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  return value;
}

/** Long hashed URLs like *-team-projects.vercel.app are per-deployment, not the public project link. */
export function isVercelDeploymentPreviewUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.vercel.app') && host.includes('-projects');
  } catch {
    return false;
  }
}

/** Prefer the stable Vercel project URL (*.vercel.app), never a one-off deployment URL. */
export function resolvePublishDisplayUrl(
  domain: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const normalizedUrl = normalizePublishUrl(url);
  if (normalizedUrl && !isVercelDeploymentPreviewUrl(normalizedUrl)) {
    return normalizedUrl;
  }
  if (domain?.trim()) {
    const custom = normalizePublishUrl(domain.includes('://') ? domain : `https://${domain}`);
    if (custom && !custom.includes('.vercel.app')) return custom;
  }
  return normalizedUrl && normalizedUrl.includes('.vercel.app') ? normalizedUrl : null;
}
