import type { ImportBundle, ImportSource } from '@theo/shared';
import { logProjectImport } from '@theo/db';
import { writeProjectFile } from './project-manager.js';
import { uploadFile } from './storage.js';
import { importFromNotion } from './integrations/notion-adapter.js';
import { importFromCanva } from './integrations/canva-adapter.js';
import { importFromFigma } from './integrations/figma-adapter.js';
import { sectionsToPlanText } from './integrations/markdown-parser.js';
import { importViaMcp } from './mcp/import-via-mcp.js';
import { mergeMcpWarnings } from './mcp/mcp-to-bundle.js';
import { createHash } from 'node:crypto';
import { tierToFramework } from './prompts.js';
import type { ModelTier } from './model-tier.js';

function frameworkPlanLabel(modelTier?: ModelTier): string {
  switch (tierToFramework(modelTier ?? 'v1')) {
    case 'html':
      return 'Plain HTML + CSS + JavaScript (single index.html)';
    case 'nextjs':
      return 'Next.js 14 + Tailwind CSS 3';
    default:
      return 'React + Vite + Tailwind CSS 4';
  }
}

function frameworkBuildInstruction(modelTier?: ModelTier): string {
  switch (tierToFramework(modelTier ?? 'v1')) {
    case 'html':
      return 'Build a plain HTML/CSS/JS landing site (single index.html) honoring imported content, colors, and assets above.';
    case 'nextjs':
      return 'Build a Next.js 14 + Tailwind landing site honoring imported content, colors, and assets above.';
    default:
      return 'Build a React + Vite + Tailwind landing site honoring imported content, colors, and assets above.';
  }
}

function designTokensInstruction(modelTier?: ModelTier): string {
  const isHtml = tierToFramework(modelTier ?? 'v1') === 'html';
  return isHtml
    ? 'DESIGN TOKENS (match in CSS custom properties in index.html):'
    : 'DESIGN TOKENS (match in Tailwind theme):';
}

type PartialWithBinary = Partial<ImportBundle> & {
  _binaryAsset?: { projectPath: string; buffer: Buffer };
  _figmaImageUrl?: string;
};

export interface ImportPipelineOptions {
  useMcp?: boolean;
}

export interface ImportPipelineResult {
  bundle: ImportBundle;
  mcpWarnings: string[];
}

function mergeBundles(bundles: PartialWithBinary[]): ImportBundle {
  const merged: ImportBundle = {
    sources: [],
    assets: [],
    designTokens: { colors: [], fonts: [], spacing: [] },
    structuredSections: [],
  };

  const markdownParts: string[] = [];
  const layoutParts: string[] = [];

  for (const b of bundles) {
    merged.sources.push(...(b.sources ?? []));
    if (b.markdownContent) markdownParts.push(b.markdownContent);
    if (b.structuredSections?.length) {
      merged.structuredSections!.push(...b.structuredSections);
    }
    if (b.assets?.length) merged.assets!.push(...b.assets);
    if (b.designTokens?.colors) merged.designTokens!.colors!.push(...b.designTokens.colors);
    if (b.designTokens?.fonts) merged.designTokens!.fonts!.push(...b.designTokens.fonts);
    if (b.designTokens?.spacing) merged.designTokens!.spacing!.push(...b.designTokens.spacing);
    if (b.layoutSummary) layoutParts.push(b.layoutSummary);
  }

  if (markdownParts.length) merged.markdownContent = markdownParts.join('\n\n---\n\n');
  if (layoutParts.length) merged.layoutSummary = layoutParts.join('\n\n');

  merged.designTokens!.colors = [...new Set(merged.designTokens!.colors)].slice(0, 12);
  merged.designTokens!.fonts = [...new Set(merged.designTokens!.fonts)].slice(0, 6);

  return merged;
}

async function applyAssetsToProject(
  projectId: string | undefined,
  bundles: PartialWithBinary[],
): Promise<void> {
  if (!projectId) return;

  for (const b of bundles) {
    if (b._binaryAsset) {
      const { projectPath, buffer } = b._binaryAsset;
      const base64 = buffer.toString('base64');
      writeProjectFile(projectId, projectPath, base64);
      try {
        await uploadFile(`projects/${projectId}/${projectPath}`, buffer);
      } catch {
        /* R2 optional */
      }
    }
    if (b._figmaImageUrl) {
      const res = await fetch(b._figmaImageUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const path = b.assets?.[0]?.projectPath ?? `public/import/figma-frame.png`;
        writeProjectFile(projectId, path, buf.toString('base64'));
        try {
          await uploadFile(`projects/${projectId}/${path}`, buf);
        } catch {
          /* R2 optional */
        }
      }
    }
  }
}

export async function runImportPipeline(
  userId: string,
  sources: ImportSource[],
  projectId?: string,
  options?: ImportPipelineOptions,
): Promise<ImportBundle> {
  const result = await runImportPipelineWithMeta(userId, sources, projectId, options);
  return result.bundle;
}

export async function runImportPipelineWithMeta(
  userId: string,
  sources: ImportSource[],
  projectId?: string,
  options?: ImportPipelineOptions,
): Promise<ImportPipelineResult> {
  const partials: PartialWithBinary[] = [];
  const mcpWarnings: string[] = [];

  for (const source of sources) {
    if (options?.useMcp) {
      const mcpResult = await importViaMcp(userId, source, projectId);
      partials.push(mcpResult.partial);
      if (mcpResult.warning) mcpWarnings.push(mcpResult.warning);
      continue;
    }

    switch (source.provider) {
      case 'notion':
        partials.push(await importFromNotion(userId, source));
        break;
      case 'canva':
        partials.push(await importFromCanva(userId, source, projectId));
        break;
      case 'figma':
        partials.push(await importFromFigma(userId, source));
        break;
    }
  }

  await applyAssetsToProject(projectId, partials);
  let bundle = mergeBundles(partials);
  bundle = mergeMcpWarnings(bundle, mcpWarnings);

  for (const source of bundle.sources) {
    const hash = createHash('sha256')
      .update(JSON.stringify({ source, projectId, useMcp: options?.useMcp ?? false }))
      .digest('hex')
      .slice(0, 16);
    await logProjectImport({
      userId,
      projectId,
      provider: source.provider,
      externalId: source.externalId,
      title: source.title,
      sourceUrl: source.url,
      snapshotHash: hash,
      metadata: options?.useMcp ? { useMcp: true } : undefined,
    }).catch(() => {});
  }

  return { bundle, mcpWarnings };
}

export function mergeImportBundleIntoDescription(
  description: string,
  bundle: ImportBundle,
  modelTier?: ModelTier,
): string {
  const parts: string[] = [description.trim()];

  if (bundle.markdownContent) {
    parts.push(
      `CONTENT SOURCE (Notion — use this copy verbatim where possible):\n${bundle.markdownContent}`,
    );
  }

  if (bundle.structuredSections?.length) {
    parts.push(
      `STRUCTURED SECTIONS (map H1→hero, H2→sections, bullets→feature grids):\n${sectionsToPlanText(bundle.structuredSections)}`,
    );
  }

  if (bundle.designTokens?.colors?.length || bundle.designTokens?.fonts?.length) {
    parts.push(
      `${designTokensInstruction(modelTier)}\nColors: ${bundle.designTokens.colors?.join(', ') ?? 'default'}\nFonts: ${bundle.designTokens.fonts?.join(', ') ?? 'default'}`,
    );
  }

  if (bundle.layoutSummary) {
    parts.push(`FIGMA LAYOUT REFERENCE:\n${bundle.layoutSummary}`);
  }

  if (bundle.assets?.length) {
    const assetLines = bundle.assets
      .map((a) => `- Use ${a.projectPath ?? a.path} in the site (${a.mime ?? 'asset'})`)
      .join('\n');
    parts.push(`IMPORTED ASSETS:\n${assetLines}`);
  }

  parts.push(frameworkBuildInstruction(modelTier));

  return parts.filter(Boolean).join('\n\n');
}

export function buildPlanFromImportBundle(bundle: ImportBundle, modelTier?: ModelTier): string {
  const lines: string[] = [
    'Project: Imported multi-source website',
    `Framework: ${frameworkPlanLabel(modelTier)}`,
  ];

  if (bundle.sources.length) {
    lines.push('Sources:');
    for (const s of bundle.sources) {
      lines.push(`- ${s.provider}: ${s.title ?? s.externalId}`);
    }
  }

  if (bundle.structuredSections?.length) {
    lines.push('Sections:');
    for (const sec of bundle.structuredSections) {
      lines.push(`- ${sec.title}: ${sec.body.slice(0, 120)}${sec.body.length > 120 ? '...' : ''}`);
    }
  } else if (bundle.markdownContent) {
    lines.push(`Content preview: ${bundle.markdownContent.slice(0, 300)}...`);
  }

  if (bundle.designTokens?.colors?.length) {
    lines.push(`Style: colors ${bundle.designTokens.colors.join(', ')}`);
  }

  return lines.join('\n');
}
