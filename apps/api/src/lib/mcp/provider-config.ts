import type { IntegrationProvider } from '@theo/shared';

export type McpTransport = 'stdio' | 'http' | 'bridge';

export interface ProviderMcpConfig {
  provider: IntegrationProvider;
  enabled: boolean;
  transport: McpTransport;
  url?: string;
  stdioCommand?: string;
  stdioArgs?: string[];
  defaultTimeoutMs: number;
  toolAllowlist?: string[];
}

export function isMcpEnabled(): boolean {
  return process.env.INTEGRATIONS_MCP_ENABLED !== 'false';
}

export function getProviderMcpConfig(provider: IntegrationProvider): ProviderMcpConfig {
  const enabled = isMcpEnabled();

  switch (provider) {
    case 'notion': {
      const mode = process.env.NOTION_MCP_MODE ?? 'stdio';
      return {
        provider,
        enabled: enabled && mode !== 'off',
        transport: mode === 'remote' ? 'http' : 'stdio',
        url: 'https://mcp.notion.com/mcp',
        stdioCommand: 'npx',
        stdioArgs: ['-y', '@notionhq/notion-mcp-server'],
        defaultTimeoutMs: 30_000,
      };
    }
    case 'figma': {
      const mode = process.env.FIGMA_MCP_MODE ?? 'bridge';
      return {
        provider,
        enabled: enabled && mode !== 'off',
        transport: mode === 'remote' ? 'http' : 'bridge',
        url: 'https://mcp.figma.com/mcp',
        defaultTimeoutMs: 45_000,
        toolAllowlist: ['get_design_context', 'download_assets', 'search_design_files'],
      };
    }
    case 'canva':
      return {
        provider,
        enabled,
        transport: 'http',
        url: 'https://mcp.canva.com/mcp',
        defaultTimeoutMs: 60_000,
        toolAllowlist: ['search-designs', 'export-design', 'download-asset', 'generate-design'],
      };
    default:
      return {
        provider,
        enabled: false,
        transport: 'bridge',
        defaultTimeoutMs: 30_000,
      };
  }
}

export function isMcpConfigured(provider: IntegrationProvider): boolean {
  const config = getProviderMcpConfig(provider);
  if (!config.enabled) return false;

  switch (provider) {
    case 'notion':
      return true;
    case 'figma':
      return config.transport === 'bridge' || !!process.env.FIGMA_CLIENT_ID;
    case 'canva':
      return !!(
        process.env.CANVA_MCP_CLIENT_ID_URL ||
        (process.env.CANVA_MCP_CLIENT_ID && process.env.CANVA_MCP_CLIENT_SECRET)
      );
    default:
      return false;
  }
}
