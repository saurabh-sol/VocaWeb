import type { ImportBundle, ImportSource } from '@theo/shared';
import { importFromNotion } from '../integrations/notion-adapter.js';
import { importFromCanva } from '../integrations/canva-adapter.js';
import { importFromFigma } from '../integrations/figma-adapter.js';
import { importNotionViaMcp } from './notion-mcp.js';
import { importFigmaViaBridge } from './figma-bridge.js';
import { importCanvaViaMcp } from './canva-mcp.js';
import { getProviderMcpConfig, isMcpEnabled } from './provider-config.js';

type PartialWithBinary = Partial<ImportBundle> & {
  _binaryAsset?: { projectPath: string; buffer: Buffer };
  _figmaImageUrl?: string;
};

export interface ImportViaMcpResult {
  partial: PartialWithBinary;
  usedMcp: boolean;
  warning?: string;
}

export async function importViaMcp(
  userId: string,
  source: ImportSource,
  projectId?: string,
): Promise<ImportViaMcpResult> {
  if (!isMcpEnabled()) {
    const partial = await importViaRest(userId, source, projectId);
    return { partial, usedMcp: false };
  }

  const config = getProviderMcpConfig(source.provider);
  if (!config.enabled) {
    const partial = await importViaRest(userId, source, projectId);
    return { partial, usedMcp: false };
  }

  try {
    let partial: PartialWithBinary;
    switch (source.provider) {
      case 'notion':
        partial = await importNotionViaMcp(userId, source);
        break;
      case 'figma':
        partial = await importFigmaViaBridge(userId, source);
        break;
      case 'canva':
        partial = await importCanvaViaMcp(userId, source, projectId);
        break;
      default:
        partial = await importViaRest(userId, source, projectId);
        return { partial, usedMcp: false };
    }
    return { partial, usedMcp: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MCP import failed';
    const partial = await importViaRest(userId, source, projectId);
    return {
      partial,
      usedMcp: false,
      warning: `${source.provider} MCP failed, used REST fallback: ${message}`,
    };
  }
}

async function importViaRest(
  userId: string,
  source: ImportSource,
  projectId?: string,
): Promise<PartialWithBinary> {
  switch (source.provider) {
    case 'notion':
      return importFromNotion(userId, source);
    case 'canva':
      return importFromCanva(userId, source, projectId);
    case 'figma':
      return importFromFigma(userId, source);
    default:
      throw new Error(`Unknown provider: ${source.provider}`);
  }
}
