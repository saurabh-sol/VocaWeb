import type { ImportBundle, ImportSource } from '@theo/shared';
import { importFromCanva } from '../integrations/canva-adapter.js';
import {
  callMcpTool,
  extractTextFromMcpResult,
  findMcpTool,
  listMcpTools,
} from './mcp-client.js';
import { canvaMcpResultToBundle } from './mcp-to-bundle.js';
import { withMcpSession } from './mcp-session.js';
import { getDecryptedCanvaMcpToken, isCanvaMcpConnected } from './canva-mcp-oauth.js';
import { getUserIntegration } from '@theo/db';
import { getProviderMcpConfig } from './provider-config.js';

async function exportCanvaDesignViaMcp(
  userId: string,
  designId: string,
  format: string,
): Promise<{ result: unknown; assetUrl?: string }> {
  const token = await getDecryptedCanvaMcpToken(userId);
  if (!token) throw new Error('Canva MCP not connected');

  return withMcpSession(userId, 'canva', { bearerToken: token }, async (handle) => {
    const tools = await listMcpTools(handle);

    const exportTool = findMcpTool(tools, [
      'export',
      'download',
      'generate-design',
      'export-design',
    ]);

    if (!exportTool) {
      throw new Error(
        `No Canva MCP export tool found (available: ${tools.map((t) => t.name).join(', ')})`,
      );
    }

    const result = await callMcpTool(handle, exportTool.name, {
      design_id: designId,
      designId,
      id: designId,
      format: format === 'png' ? 'png' : format,
    });

    const text = extractTextFromMcpResult(result);
    const urlMatch = text.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp)/i);
    return { result, assetUrl: urlMatch?.[0] };
  });
}

export async function importCanvaViaMcp(
  userId: string,
  source: ImportSource,
  projectId?: string,
): Promise<Partial<ImportBundle> & { _binaryAsset?: { projectPath: string; buffer: Buffer } }> {
  const config = getProviderMcpConfig('canva');
  if (!config.enabled) {
    return importFromCanva(userId, source, projectId);
  }

  const row = await getUserIntegration(userId, 'canva');
  if (!isCanvaMcpConnected(row?.metadata)) {
    return importFromCanva(userId, source, projectId);
  }

  try {
    const format = source.format ?? 'png';
    const { result, assetUrl } = await exportCanvaDesignViaMcp(
      userId,
      source.externalId,
      format,
    );

    const bundle = canvaMcpResultToBundle(source, result, assetUrl);

    if (assetUrl) {
      try {
        const res = await fetch(assetUrl);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const path = bundle.assets?.[0]?.projectPath ?? `public/import/canva-${source.externalId.slice(0, 8)}.png`;
          bundle._binaryAsset = { projectPath: path, buffer };
        }
      } catch {
        /* asset fetch optional */
      }
    }

    return bundle;
  } catch {
    return importFromCanva(userId, source, projectId);
  }
}

export async function exportCanvaAssetForAgent(
  userId: string,
  designId: string,
): Promise<string> {
  const { result } = await exportCanvaDesignViaMcp(userId, designId, 'png');
  return extractTextFromMcpResult(result);
}
