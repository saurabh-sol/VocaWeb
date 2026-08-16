import type { IntegrationProvider } from '@theo/shared';
import { listUserIntegrations } from '@theo/db';
import { searchNotionViaMcp } from './mcp/notion-mcp.js';
import { getFigmaContextForAgent } from './mcp/figma-bridge.js';
import { exportCanvaAssetForAgent } from './mcp/canva-mcp.js';
import { isMcpEnabled } from './mcp/provider-config.js';

export interface IntegrationToolResult {
  success: boolean;
  output: string;
}

export async function executeIntegrationTool(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<IntegrationToolResult> {
  if (!isMcpEnabled()) {
    return { success: false, output: 'MCP integrations are disabled' };
  }

  try {
    switch (toolName) {
      case 'integration_search_notion': {
        const query = String(args.query ?? '');
        if (!query) return { success: false, output: 'query is required' };
        const output = await searchNotionViaMcp(userId, query);
        return { success: true, output };
      }

      case 'integration_figma_context': {
        const fileKey = String(args.fileKey ?? args.url ?? '');
        const frameId = args.frameId ? String(args.frameId) : undefined;
        if (!fileKey) return { success: false, output: 'fileKey or url is required' };
        const output = await getFigmaContextForAgent(userId, fileKey, frameId);
        return { success: true, output };
      }

      case 'integration_canva_export': {
        const designId = String(args.designId ?? args.externalId ?? '');
        if (!designId) return { success: false, output: 'designId is required' };
        const output = await exportCanvaAssetForAgent(userId, designId);
        return { success: true, output };
      }

      default:
        return { success: false, output: `Unknown integration tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Integration tool failed';
    return { success: false, output: message };
  }
}

export async function getConnectedIntegrations(
  userId: string,
): Promise<IntegrationProvider[]> {
  const rows = await listUserIntegrations(userId);
  return rows.map((r) => r.provider);
}

export async function buildIntegrationContextForAgent(
  userId: string,
  providers: IntegrationProvider[],
): Promise<string> {
  if (!isMcpEnabled() || providers.length === 0) return '';

  const lines = [
    'Connected integrations (MCP tools available):',
    ...providers.map((p) => `- ${p}`),
    'Use integration_search_notion, integration_figma_context, integration_canva_export when needed.',
  ];
  return lines.join('\n');
}
