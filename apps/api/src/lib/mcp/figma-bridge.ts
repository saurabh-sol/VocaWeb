import type { ImportBundle, ImportSource } from '@theo/shared';
import {
  exportFigmaFrameImages,
  extractDesignTokens,
  extractFigmaFileKey,
  fetchFigmaFile,
  importFromFigma,
  summarizeLayoutForCodegen,
  type FigmaNode,
} from '../integrations/figma-adapter.js';

interface FigmaNodeLike {
  id: string;
  name: string;
  type: string;
  children?: FigmaNodeLike[];
  fills?: Array<{ type?: string; color?: { r: number; g: number; b: number } }>;
  style?: { fontFamily?: string; fontSize?: number };
  absoluteBoundingBox?: { width?: number; height?: number };
  characters?: string;
}

function findNode(node: FigmaNodeLike, frameId?: string): FigmaNodeLike {
  if (!frameId) {
    const frame = node.children?.find((c) => c.type === 'FRAME' || c.type === 'COMPONENT');
    return frame ?? node;
  }

  const walk = (n: FigmaNodeLike): FigmaNodeLike | null => {
    if (n.id === frameId) return n;
    for (const c of n.children ?? []) {
      const f = walk(c);
      if (f) return f;
    }
    return null;
  };

  return walk(node) ?? node;
}

/** REST-backed tools matching Figma MCP tool names until catalog approval. */
export async function getDesignContext(
  userId: string,
  fileKeyOrUrl: string,
  frameId?: string,
): Promise<{ layoutSummary: string; designTokens: ReturnType<typeof extractDesignTokens> }> {
  const fileKey = extractFigmaFileKey(fileKeyOrUrl) ?? fileKeyOrUrl;
  const fileData = (await fetchFigmaFile(userId, fileKey)) as { document?: FigmaNodeLike };
  const doc = fileData.document;
  if (!doc) throw new Error('Figma file has no document');

  const targetNode = findNode(doc, frameId);
  return {
    layoutSummary: summarizeLayoutForCodegen(targetNode as FigmaNode),
    designTokens: extractDesignTokens(targetNode as FigmaNode),
  };
}

export async function downloadAssets(
  userId: string,
  fileKeyOrUrl: string,
  nodeIds: string[],
): Promise<Record<string, string>> {
  const fileKey = extractFigmaFileKey(fileKeyOrUrl) ?? fileKeyOrUrl;
  return exportFigmaFrameImages(userId, fileKey, nodeIds);
}

export async function importFigmaViaBridge(
  userId: string,
  source: ImportSource,
): Promise<Partial<ImportBundle> & { _figmaImageUrl?: string }> {
  const fileKey = extractFigmaFileKey(source.externalId) ?? source.externalId;

  try {
    const fileData = (await fetchFigmaFile(userId, fileKey)) as {
      name?: string;
      document?: FigmaNodeLike;
    };
    const doc = fileData.document;
    if (!doc) throw new Error('Figma file has no document');

    const targetNode = findNode(doc, source.frameId);
    const { layoutSummary, designTokens } = await getDesignContext(
      userId,
      fileKey,
      targetNode.id,
    );
    const images = await downloadAssets(userId, fileKey, [targetNode.id]);
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
      layoutSummary: `[MCP bridge: get_design_context]\n${layoutSummary}`,
      assets,
      _figmaImageUrl: imageUrl,
    };
  } catch {
    return importFromFigma(userId, source);
  }
}

export async function getFigmaContextForAgent(
  userId: string,
  fileKeyOrUrl: string,
  frameId?: string,
): Promise<string> {
  const ctx = await getDesignContext(userId, fileKeyOrUrl, frameId);
  return [
    'FIGMA DESIGN CONTEXT (MCP bridge):',
    ctx.layoutSummary,
    `Colors: ${ctx.designTokens.colors.join(', ') || 'default'}`,
    `Fonts: ${ctx.designTokens.fonts.join(', ') || 'default'}`,
  ].join('\n');
}
