import type { ImportBundle, ImportSource } from '@theo/shared';
import { getDecryptedAccessToken, saveIntegrationTokens } from './token-store.js';

function getFigmaRedirectUri(): string {
  const base =
    process.env.INTEGRATIONS_CALLBACK_BASE ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/integrations/figma/callback`;
}

export function getFigmaAuthUrl(state: string): string {
  const clientId = process.env.FIGMA_CLIENT_ID!;
  const redirectUri = encodeURIComponent(
    process.env.FIGMA_REDIRECT_URI ?? getFigmaRedirectUri(),
  );
  const scopes = encodeURIComponent('file_content:read file_metadata:read');
  return `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;
}

export async function exchangeFigmaCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  userId?: string;
}> {
  const clientId = process.env.FIGMA_CLIENT_ID!;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET!;
  const redirectUri = process.env.FIGMA_REDIRECT_URI ?? getFigmaRedirectUri();

  const res = await fetch('https://api.figma.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    throw new Error(`Figma token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userId: data.user_id,
  };
}

async function figmaFetch(userId: string, path: string) {
  const token = await getDecryptedAccessToken(userId, 'figma');
  if (!token) throw new Error('Figma not connected');

  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function extractFigmaFileKey(input: string): string | null {
  const match = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: Array<{ type?: string; color?: { r: number; g: number; b: number; a?: number } }>;
  style?: { fontFamily?: string; fontSize?: number };
  absoluteBoundingBox?: { width?: number; height?: number; x?: number; y?: number };
  characters?: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function extractDesignTokens(document: FigmaNode): {
  colors: string[];
  fonts: string[];
  spacing: number[];
} {
  const colors = new Set<string>();
  const fonts = new Set<string>();
  const spacing = new Set<number>();

  const walk = (node: FigmaNode, depth = 0) => {
    for (const fill of node.fills ?? []) {
      if (fill.type === 'SOLID' && fill.color) {
        colors.add(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
      }
    }
    if (node.style?.fontFamily) fonts.add(node.style.fontFamily);
    if (node.absoluteBoundingBox?.width) {
      spacing.add(Math.round(node.absoluteBoundingBox.width));
    }
    if (depth < 8) {
      for (const child of node.children ?? []) walk(child, depth + 1);
    }
  };

  walk(document);
  return {
    colors: [...colors].slice(0, 12),
    fonts: [...fonts].slice(0, 6),
    spacing: [...spacing].slice(0, 8),
  };
}

export function summarizeLayoutForCodegen(
  node: FigmaNode,
  maxDepth = 4,
  depth = 0,
): string {
  if (depth > maxDepth) return '';
  const parts: string[] = [];
  const size = node.absoluteBoundingBox
    ? `${Math.round(node.absoluteBoundingBox.width ?? 0)}x${Math.round(node.absoluteBoundingBox.height ?? 0)}`
    : '';
  const text = node.characters ? ` text="${node.characters.slice(0, 80)}"` : '';
  parts.push(`${'  '.repeat(depth)}- ${node.type} "${node.name}"${size ? ` (${size})` : ''}${text}`);

  for (const child of node.children ?? []) {
    parts.push(summarizeLayoutForCodegen(child, maxDepth, depth + 1));
  }
  return parts.filter(Boolean).join('\n');
}

export async function fetchFigmaFile(userId: string, fileKey: string) {
  return figmaFetch(userId, `/files/${fileKey}?depth=2`);
}

export async function exportFigmaFrameImages(
  userId: string,
  fileKey: string,
  nodeIds: string[],
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};
  const ids = nodeIds.join(',');
  const data = (await figmaFetch(
    userId,
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
  )) as { images?: Record<string, string> };
  return data.images ?? {};
}

export async function importFromFigma(
  userId: string,
  source: ImportSource,
): Promise<Partial<ImportBundle>> {
  const fileKey = extractFigmaFileKey(source.externalId) ?? source.externalId;
  const fileData = (await fetchFigmaFile(userId, fileKey)) as {
    name?: string;
    document?: FigmaNode;
  };

  const doc = fileData.document;
  if (!doc) throw new Error('Figma file has no document');

  let targetNode = doc;
  if (source.frameId) {
    const findNode = (node: FigmaNode): FigmaNode | null => {
      if (node.id === source.frameId) return node;
      for (const child of node.children ?? []) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    targetNode = findNode(doc) ?? doc;
  } else {
    const frame = doc.children?.find((c) => c.type === 'FRAME' || c.type === 'COMPONENT');
    if (frame) targetNode = frame;
  }

  const designTokens = extractDesignTokens(targetNode);
  const layoutSummary = summarizeLayoutForCodegen(targetNode);
  const images = await exportFigmaFrameImages(userId, fileKey, [targetNode.id]);
  const imageUrl = images[targetNode.id];

  const assets = imageUrl
    ? [
        {
          path: `public/import/figma-${fileKey.slice(0, 8)}.png`,
          url: imageUrl,
          mime: 'image/png',
          projectPath: `public/import/figma-${fileKey.slice(0, 8)}.png`,
        },
      ]
    : [];

  return {
    sources: [
      {
        provider: 'figma',
        externalId: fileKey,
        title: source.title ?? fileData.name,
        url: source.url ?? `https://www.figma.com/file/${fileKey}`,
      },
    ],
    designTokens,
    layoutSummary,
    assets,
    _figmaImageUrl: imageUrl,
  } as Partial<ImportBundle> & { _figmaImageUrl?: string };
}

export async function saveFigmaIntegration(userId: string, code: string): Promise<void> {
  const tokens = await exchangeFigmaCode(code);
  await saveIntegrationTokens({
    userId,
    provider: 'figma',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    metadata: { figmaUserId: tokens.userId },
  });
}

export async function listFigmaFilesFromRecent(
  userId: string,
  fileKeys: string[],
): Promise<Array<{ id: string; title: string; url: string }>> {
  const results: Array<{ id: string; title: string; url: string }> = [];
  for (const key of fileKeys.slice(0, 10)) {
    try {
      const data = (await fetchFigmaFile(userId, key)) as { name?: string };
      results.push({
        id: key,
        title: data.name ?? key,
        url: `https://www.figma.com/file/${key}`,
      });
    } catch {
      /* skip invalid keys */
    }
  }
  return results;
}
