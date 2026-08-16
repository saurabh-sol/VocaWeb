import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { IntegrationProvider } from '@theo/shared';
import { getProviderMcpConfig, type McpTransport } from './provider-config.js';

export interface McpToolInfo {
  name: string;
  description?: string;
}

export interface McpAuthContext {
  bearerToken?: string;
  stdioEnv?: Record<string, string>;
}

export interface McpClientHandle {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  provider: IntegrationProvider;
  transportType: McpTransport;
}

const CLIENT_INFO = { name: 'vocaweb-api', version: '1.0.0' };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function createMcpClient(
  provider: IntegrationProvider,
  auth: McpAuthContext,
): Promise<McpClientHandle> {
  const config = getProviderMcpConfig(provider);
  if (!config.enabled) {
    throw new Error(`MCP disabled for ${provider}`);
  }

  const client = new Client(CLIENT_INFO);

  if (config.transport === 'stdio') {
    const transport = new StdioClientTransport({
      command: config.stdioCommand ?? 'npx',
      args: config.stdioArgs ?? [],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] != null),
        ),
        ...auth.stdioEnv,
      },
      stderr: 'pipe',
    });
    await transport.start();
    await client.connect(transport);
    return { client, transport, provider, transportType: 'stdio' };
  }

  if (config.transport === 'http') {
    if (!config.url) throw new Error(`No MCP URL configured for ${provider}`);
    const url = new URL(config.url);
    const headers: Record<string, string> = {};
    if (auth.bearerToken) {
      headers.Authorization = `Bearer ${auth.bearerToken}`;
    }
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await transport.start();
    await client.connect(transport);
    return { client, transport, provider, transportType: 'http' };
  }

  throw new Error(`Cannot create MCP client for bridge transport (${provider})`);
}

export async function closeMcpClient(handle: McpClientHandle): Promise<void> {
  try {
    await handle.client.close();
  } catch {
    /* ignore */
  }
  try {
    await handle.transport.close();
  } catch {
    /* ignore */
  }
}

export async function listMcpTools(handle: McpClientHandle): Promise<McpToolInfo[]> {
  const result = await handle.client.listTools();
  return (result.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
  }));
}

export async function callMcpTool(
  handle: McpClientHandle,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
): Promise<unknown> {
  const config = getProviderMcpConfig(handle.provider);
  const timeout = timeoutMs ?? config.defaultTimeoutMs;

  const result = await withTimeout(
    handle.client.callTool({ name: toolName, arguments: args }),
    timeout,
    `MCP tool ${toolName}`,
  );

  return result;
}

export function extractTextFromMcpResult(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result ?? '');

  const r = result as {
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: unknown;
  };

  if (r.content?.length) {
    return r.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!)
      .join('\n');
  }

  if (r.structuredContent) {
    return typeof r.structuredContent === 'string'
      ? r.structuredContent
      : JSON.stringify(r.structuredContent, null, 2);
  }

  return JSON.stringify(result, null, 2);
}

export function findMcpTool(
  tools: McpToolInfo[],
  namePatterns: string[],
): McpToolInfo | undefined {
  const lowerPatterns = namePatterns.map((p) => p.toLowerCase());
  return tools.find((t) => {
    const name = t.name.toLowerCase();
    const desc = (t.description ?? '').toLowerCase();
    return lowerPatterns.some((p) => name.includes(p) || desc.includes(p));
  });
}
