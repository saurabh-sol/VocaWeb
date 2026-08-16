import type { ImportBundle, ImportSource, IntegrationProvider } from '@theo/shared';
import { parseMarkdownToSections } from '../integrations/markdown-parser.js';
import { extractTextFromMcpResult } from './mcp-client.js';

export function notionMcpResultToBundle(
  source: ImportSource,
  result: unknown,
): Partial<ImportBundle> {
  const text = extractTextFromMcpResult(result);
  const structuredSections = parseMarkdownToSections(text);

  return {
    sources: [
      {
        provider: 'notion',
        externalId: source.externalId,
        title: source.title,
        url: source.url,
      },
    ],
    markdownContent: text,
    structuredSections,
  };
}

export function canvaMcpResultToBundle(
  source: ImportSource,
  result: unknown,
  assetUrl?: string,
): Partial<ImportBundle> & { _binaryAsset?: { projectPath: string; buffer: Buffer } } {
  const text = extractTextFromMcpResult(result);
  const slug = source.externalId.slice(0, 8);
  const projectPath = `public/import/canva-${slug}.png`;

  const bundle: Partial<ImportBundle> & {
    _binaryAsset?: { projectPath: string; buffer: Buffer };
  } = {
    sources: [
      {
        provider: 'canva',
        externalId: source.externalId,
        title: source.title,
        url: source.url,
      },
    ],
    markdownContent: text ? `Canva design context:\n${text}` : undefined,
  };

  if (assetUrl) {
    bundle.assets = [
      {
        path: projectPath,
        url: assetUrl,
        mime: 'image/png',
        projectPath,
      },
    ];
  }

  return bundle;
}

export function figmaBridgeResultToBundle(
  source: ImportSource,
  partial: Partial<ImportBundle> & { _figmaImageUrl?: string },
): Partial<ImportBundle> & { _figmaImageUrl?: string } {
  return {
    ...partial,
    sources: partial.sources ?? [
      {
        provider: 'figma' as IntegrationProvider,
        externalId: source.externalId,
        title: source.title,
        url: source.url,
      },
    ],
  };
}

export function mergeMcpWarnings(bundle: ImportBundle, warnings: string[]): ImportBundle {
  if (warnings.length === 0) return bundle;
  const note = `\n\n[MCP notes: ${warnings.join('; ')}]`;
  return {
    ...bundle,
    markdownContent: (bundle.markdownContent ?? '') + note,
  };
}
