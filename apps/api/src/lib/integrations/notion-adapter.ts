import type { ImportBundle, ImportSource } from '@theo/shared';
import { getDecryptedAccessToken, saveIntegrationTokens } from './token-store.js';
import { parseMarkdownToSections } from './markdown-parser.js';

const NOTION_VERSION = '2022-06-28';

export function getNotionAuthUrl(state: string): string {
  const clientId = process.env.NOTION_CLIENT_ID!;
  const redirectUri = encodeURIComponent(
    process.env.NOTION_REDIRECT_URI ?? getNotionRedirectUri(),
  );
  return `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}&state=${encodeURIComponent(state)}`;
}

function getNotionRedirectUri(): string {
  const base =
    process.env.INTEGRATIONS_CALLBACK_BASE ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3001';
  return `${base.replace(/\/$/, '')}/api/integrations/notion/callback`;
}

export async function exchangeNotionCode(code: string): Promise<{
  accessToken: string;
  workspaceName?: string;
  botId?: string;
}> {
  const clientId = process.env.NOTION_CLIENT_ID!;
  const clientSecret = process.env.NOTION_CLIENT_SECRET!;
  const redirectUri = process.env.NOTION_REDIRECT_URI ?? getNotionRedirectUri();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion token exchange failed: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    workspace_name?: string;
    bot_id?: string;
  };

  return {
    accessToken: data.access_token,
    workspaceName: data.workspace_name,
    botId: data.bot_id,
  };
}

async function notionFetch(userId: string, path: string, init?: RequestInit) {
  const token = await getDecryptedAccessToken(userId, 'notion');
  if (!token) throw new Error('Notion not connected');

  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error: ${res.status} ${text}`);
  }
  return res.json();
}

type NotionPageResult = {
  id: string;
  url?: string;
  properties?: Record<string, { title?: Array<{ plain_text?: string }> }>;
};

function extractNotionPageTitle(page: NotionPageResult): string {
  for (const prop of Object.values(page.properties ?? {})) {
    if (prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
  }
  return 'Untitled';
}

function mapNotionPage(page: NotionPageResult): { id: string; title: string; url?: string } {
  return {
    id: page.id,
    title: extractNotionPageTitle(page),
    url: page.url,
  };
}

export async function listNotionPages(
  userId: string,
  options?: { query?: string },
): Promise<Array<{ id: string; title: string; url?: string }>> {
  const pages: Array<{ id: string; title: string; url?: string }> = [];
  const seen = new Set<string>();
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: 'object', value: 'page' },
      page_size: 100,
    };
    if (options?.query?.trim()) body.query = options.query.trim();
    if (cursor) body.start_cursor = cursor;

    const data = (await notionFetch(userId, '/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as {
      results: NotionPageResult[];
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const page of data.results) {
      if (seen.has(page.id)) continue;
      seen.add(page.id);
      pages.push(mapNotionPage(page));
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor && pages.length < 200);

  return pages.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getNotionPageResource(
  userId: string,
  pageIdOrUrl: string,
): Promise<{ id: string; title: string; url?: string } | null> {
  const pageId = extractNotionPageId(pageIdOrUrl) ?? pageIdOrUrl;
  try {
    const page = (await notionFetch(userId, `/pages/${pageId}`)) as NotionPageResult;
    return mapNotionPage(page);
  } catch {
    return null;
  }
}

export async function fetchNotionPageMarkdown(
  userId: string,
  pageId: string,
): Promise<string> {
  // Try markdown endpoint (newer Notion API)
  const token = await getDecryptedAccessToken(userId, 'notion');
  if (!token) throw new Error('Notion not connected');

  const mdRes = await fetch(`https://api.notion.com/v1/pages/${pageId}/markdown`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2026-03-11',
    },
  });

  if (mdRes.ok) {
    const mdData = (await mdRes.json()) as { markdown?: string; truncated?: boolean };
    let markdown = mdData.markdown ?? '';
    if (mdData.truncated) {
      markdown += '\n\n[Content truncated — additional blocks may exist in Notion]';
    }
    return markdown;
  }

  // Fallback: block children → plain text
  const blocks = (await notionFetch(userId, `/blocks/${pageId}/children`)) as {
    results: Array<{ type: string; [key: string]: unknown }>;
  };

  const lines: string[] = [];
  for (const block of blocks.results) {
    const type = block.type;
    const payload = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
    const text = payload?.rich_text?.map((t) => t.plain_text ?? '').join('') ?? '';
    if (!text) continue;
    if (type.startsWith('heading_')) {
      const level = type.replace('heading_', '');
      lines.push(`${'#'.repeat(Number(level) || 1)} ${text}`);
    } else if (type === 'bulleted_list_item') {
      lines.push(`- ${text}`);
    } else {
      lines.push(text);
    }
  }
  return lines.join('\n\n');
}

export async function importFromNotion(
  userId: string,
  source: ImportSource,
): Promise<Partial<ImportBundle>> {
  const markdown = await fetchNotionPageMarkdown(userId, source.externalId);
  const structuredSections = parseMarkdownToSections(markdown);

  return {
    sources: [
      {
        provider: 'notion',
        externalId: source.externalId,
        title: source.title,
        url: source.url,
      },
    ],
    markdownContent: markdown,
    structuredSections,
  };
}

export async function saveNotionIntegration(
  userId: string,
  code: string,
): Promise<void> {
  const tokens = await exchangeNotionCode(code);
  await saveIntegrationTokens({
    userId,
    provider: 'notion',
    accessToken: tokens.accessToken,
    metadata: {
      workspaceName: tokens.workspaceName,
      botId: tokens.botId,
    },
  });
}

export function extractNotionPageId(input: string): string | null {
  const uuidMatch = input.match(
    /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (!uuidMatch) return null;
  const raw = uuidMatch[1].replace(/-/g, '');
  if (raw.length === 32) {
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return uuidMatch[1];
}
