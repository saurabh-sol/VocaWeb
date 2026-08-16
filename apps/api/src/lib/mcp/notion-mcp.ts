import type { ImportBundle, ImportSource } from '@theo/shared';
import { getDecryptedAccessToken } from '../integrations/token-store.js';
import { fetchNotionPageMarkdown, importFromNotion } from '../integrations/notion-adapter.js';
import {
  callMcpTool,
  findMcpTool,
  listMcpTools,
} from './mcp-client.js';
import { notionMcpResultToBundle } from './mcp-to-bundle.js';
import { withMcpSession } from './mcp-session.js';
import { getProviderMcpConfig } from './provider-config.js';

async function fetchNotionPageViaMcpTools(
  userId: string,
  pageId: string,
): Promise<unknown> {
  const token = await getDecryptedAccessToken(userId, 'notion');
  if (!token) throw new Error('Notion not connected');

  return withMcpSession(userId, 'notion', { stdioEnv: { NOTION_TOKEN: token } }, async (handle) => {
    const tools = await listMcpTools(handle);

    const markdownTool = findMcpTool(tools, [
      'markdown',
      'page_markdown',
      'get-page-markdown',
      'pages/markdown',
    ]);
    if (markdownTool) {
      return callMcpTool(handle, markdownTool.name, {
        page_id: pageId,
        pageId,
        id: pageId,
      });
    }

    const retrieveTool = findMcpTool(tools, ['retrieve', 'get-page', 'get_page', 'pages/']);
    if (retrieveTool) {
      return callMcpTool(handle, retrieveTool.name, {
        page_id: pageId,
        pageId,
        id: pageId,
      });
    }

    const searchTool = findMcpTool(tools, ['search']);
    if (searchTool) {
      return callMcpTool(handle, searchTool.name, {
        query: pageId,
        filter: { property: 'object', value: 'page' },
      });
    }

    throw new Error(
      `No suitable Notion MCP tool found (available: ${tools.map((t) => t.name).join(', ')})`,
    );
  });
}

export async function importNotionViaMcp(
  userId: string,
  source: ImportSource,
): Promise<Partial<ImportBundle>> {
  const config = getProviderMcpConfig('notion');
  if (!config.enabled) {
    return importFromNotion(userId, source);
  }

  try {
    const result = await fetchNotionPageViaMcpTools(userId, source.externalId);
    const bundle = notionMcpResultToBundle(source, result);
    if (bundle.markdownContent?.trim()) {
      return bundle;
    }
    throw new Error('Notion MCP returned empty content');
  } catch {
    const markdown = await fetchNotionPageMarkdown(userId, source.externalId);
    return notionMcpResultToBundle(source, { content: [{ type: 'text', text: markdown }] });
  }
}

export async function searchNotionViaMcp(
  userId: string,
  query: string,
): Promise<string> {
  const token = await getDecryptedAccessToken(userId, 'notion');
  if (!token) throw new Error('Notion not connected');

  return withMcpSession(userId, 'notion', { stdioEnv: { NOTION_TOKEN: token } }, async (handle) => {
    const tools = await listMcpTools(handle);
    const searchTool = findMcpTool(tools, ['search']);
    if (!searchTool) throw new Error('Notion MCP search tool not available');

    const result = await callMcpTool(handle, searchTool.name, { query });
    const { extractTextFromMcpResult } = await import('./mcp-client.js');
    return extractTextFromMcpResult(result);
  });
}
