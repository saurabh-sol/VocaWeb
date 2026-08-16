import { appendTranscriptContext } from './conversation-context.js';
import { runAgenticCodegen } from './agent-loop.js';
import {
  createProject,
  getProjectFileTree,
  persistProjectToDb,
  writeProjectFile,
} from './project-manager.js';
import { generateSiteImages, imagePathsForPrompt } from './image-generator.js';
import { getOpenAiKey } from './ai-keys.js';
import type { OrchestratorContext } from './orchestrator.js';
import { tierToFramework } from './prompts.js';
import type { ModelTier } from './token-gate.js';

export interface VoiceActionRequest {
  tool: string;
  args: Record<string, unknown>;
  projectId?: string;
  userId?: string;
  transcript?: string;
  modelTier?: string;
}

export interface VoiceActionResult {
  success: boolean;
  message: string;
  projectId?: string;
  files?: Record<string, string>;
  filesGenerated?: number;
  skillsUsed?: string[];
}

const VOICE_CTX = { channel: 'voice' as const };

function projectNameFromDescription(description: string): string {
  return description.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Untitled';
}

function requireProject(projectId: string | undefined): VoiceActionResult | null {
  if (!projectId) {
    return {
      success: false,
      message:
        'No project yet. Tell me what website you want and I will build it for you.',
    };
  }
  const files = getProjectFileTree(projectId);
  if (Object.keys(files).length === 0) {
    return {
      success: false,
      message:
        'No project yet. Describe the website you want and confirm when you are ready to build.',
    };
  }
  return null;
}

function buildVoiceHistory(transcript?: string): OrchestratorContext['conversationHistory'] {
  if (!transcript?.trim()) return undefined;
  return transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('User:')) {
        return { role: 'user', content: line.replace(/^User:\s*/, '') };
      }
      if (line.startsWith('Vocaweb:') || line.startsWith('Drooper:')) {
        return {
          role: 'assistant',
          content: line.replace(/^(Vocaweb|Drooper):\s*/, ''),
        };
      }
      return { role: 'user', content: line };
    });
}

async function runOrchestrateWithImages(
  intent: string,
  args: Record<string, unknown>,
  context: OrchestratorContext,
  description: string,
) {
  let preGeneratedAssets: Record<string, string> = {};
  try {
    const imageB64 = await generateSiteImages(description, getOpenAiKey());
    preGeneratedAssets = Object.fromEntries(
      imagePathsForPrompt(imageB64).map((p) => [p, 'generated']),
    );
    for (const [path, b64] of Object.entries(imageB64)) {
      writeProjectFile(context.projectId, path, b64);
    }
  } catch (err) {
    console.error('Image generation skipped:', err);
  }

  return runAgenticCodegen(intent, args, {
    ...context,
    ...VOICE_CTX,
    preGeneratedAssets,
  });
}

export async function executeVoiceAction(
  req: VoiceActionRequest,
): Promise<VoiceActionResult> {
  const { tool, args, userId = 'anonymous', transcript } = req;
  let { projectId } = req;
  const conversationHistory = buildVoiceHistory(transcript);

  switch (tool) {
    case 'build_website': {
      let description = String(args.description ?? '').trim();
      description = appendTranscriptContext(description, transcript);
      if (!description) {
        return { success: false, message: 'I need a description of what to build.' };
      }

      const style = args.style ? String(args.style) : '';
      const fullDescription = style ? `${description}. Style: ${style}` : description;
      const voiceFramework = req.modelTier
        ? tierToFramework(req.modelTier)
        : (String(args.framework ?? 'react-vite'));
      const name = projectNameFromDescription(fullDescription);
      const project = createProject(name, voiceFramework);
      projectId = project.id;

      const buildResult = await runOrchestrateWithImages(
        'build_website',
        { description: fullDescription, framework: voiceFramework },
        { userId, projectId: project.id, conversationHistory, framework: tierToFramework(req.modelTier ?? 'v2') },
        fullDescription,
      );

      const files = buildResult.files;
      const fileNames = Object.keys(files);

      if (userId !== 'anonymous') {
        await persistProjectToDb(project.id, userId, project.name, project.framework);
      }

      return {
        success: true,
        message: `Built successfully with ${fileNames.length} files. Live preview is opening now.`,
        projectId: project.id,
        files,
        filesGenerated: fileNames.length,
        skillsUsed: buildResult.skillsUsed,
      };
    }

    case 'edit_code': {
      const missing = requireProject(projectId);
      if (missing) return missing;

      const instruction = appendTranscriptContext(String(args.instruction ?? ''), transcript);
      const targetFiles = args.target_files as string[] | undefined;
      let projectFiles = getProjectFileTree(projectId!);
      if (targetFiles?.length) {
        projectFiles = Object.fromEntries(
          Object.entries(projectFiles).filter(([path]) => targetFiles.includes(path)),
        );
      }

      const result = await runAgenticCodegen(
        'edit_code',
        { instruction },
        {
          userId,
          projectId: projectId!,
          projectFiles,
          conversationHistory,
          ...VOICE_CTX,
        },
      );

      if (userId !== 'anonymous') {
        await persistProjectToDb(projectId!, userId);
      }

      return {
        success: true,
        message: 'Changes applied. Check the live preview for updates.',
        projectId,
        files: result.files,
        filesGenerated: Object.keys(result.files).length,
        skillsUsed: result.skillsUsed,
      };
    }

    case 'change_style': {
      const missing = requireProject(projectId);
      if (missing) return missing;

      const instruction = appendTranscriptContext(String(args.instruction ?? ''), transcript);
      const result = await runAgenticCodegen(
        'ui_improve',
        { instruction },
        {
          userId,
          projectId: projectId!,
          projectFiles: getProjectFileTree(projectId!),
          conversationHistory,
          ...VOICE_CTX,
        },
      );

      if (userId !== 'anonymous') {
        await persistProjectToDb(projectId!, userId);
      }

      return {
        success: true,
        message: 'Style updated. Take a look at the live preview.',
        projectId,
        files: result.files,
        filesGenerated: Object.keys(result.files).length,
        skillsUsed: result.skillsUsed,
      };
    }

    case 'add_section': {
      const missing = requireProject(projectId);
      if (missing) return missing;

      const description = String(args.description ?? '');
      const position = args.position ? String(args.position) : 'an appropriate location';
      const instruction = appendTranscriptContext(
        `Add a new section: ${description}. Place it at ${position}.`,
        transcript,
      );

      const result = await runAgenticCodegen(
        'edit_code',
        { instruction },
        {
          userId,
          projectId: projectId!,
          projectFiles: getProjectFileTree(projectId!),
          conversationHistory,
          ...VOICE_CTX,
        },
      );

      if (userId !== 'anonymous') {
        await persistProjectToDb(projectId!, userId);
      }

      return {
        success: true,
        message: 'New section added. It should appear in the live preview.',
        projectId,
        files: result.files,
        filesGenerated: Object.keys(result.files).length,
        skillsUsed: result.skillsUsed,
      };
    }

    case 'fix_error': {
      const missing = requireProject(projectId);
      if (missing) return missing;

      const errorMsg = appendTranscriptContext(String(args.error_message ?? ''), transcript);
      const result = await runAgenticCodegen(
        'fix_error',
        { error_message: errorMsg },
        {
          userId,
          projectId: projectId!,
          projectFiles: getProjectFileTree(projectId!),
          conversationHistory,
          ...VOICE_CTX,
        },
      );

      if (userId !== 'anonymous') {
        await persistProjectToDb(projectId!, userId);
      }

      return {
        success: true,
        message: 'Fix applied. The preview should reload shortly.',
        projectId,
        files: result.files,
        filesGenerated: Object.keys(result.files).length,
        skillsUsed: result.skillsUsed,
      };
    }

    case 'deploy_project':
      return {
        success: true,
        message:
          'Tap the Deploy button in the top bar to publish your site to Vercel.',
      };

    case 'import_sources': {
      const sources = args.sources as import('@theo/shared').ImportSource[];

      if (!sources?.length) {
        return {
          success: false,
          message:
            'Tell me which sources to import — Notion page, Canva design, or Figma file — or use Import from sources in the dashboard.',
        };
      }

      const useMcp = args.useMcp === true || /\bvia mcp\b/i.test(String(args.description ?? ''));
      const importTier = (req.modelTier ?? 'v1') as ModelTier;
      const importFramework = tierToFramework(importTier);
      const { runImportPipelineWithMeta, mergeImportBundleIntoDescription, buildPlanFromImportBundle } =
        await import('./import-pipeline.js');

      const { bundle } = await runImportPipelineWithMeta(userId, sources, projectId, { useMcp });
      const description = mergeImportBundleIntoDescription(
        String(args.description ?? 'Build from imported sources'),
        bundle,
        importTier,
      );
      const confirmedPlan = buildPlanFromImportBundle(bundle, importTier);

      const name = projectNameFromDescription(description);
      const project = projectId
        ? { id: projectId, name, framework: importFramework }
        : createProject(name, importFramework);
      if (!projectId) projectId = project.id;

      const buildResult = await runOrchestrateWithImages(
        'build_website',
        { description, framework: importFramework },
        {
          userId,
          projectId: project.id,
          conversationHistory,
          confirmedPlan,
          useMcp,
          framework: importFramework,
        },
        description,
      );

      if (userId !== 'anonymous') {
        await persistProjectToDb(project.id, userId, name, importFramework);
      }

      return {
        success: true,
        message: `Built from ${sources.length} imported source(s). Live preview is opening.`,
        projectId: project.id,
        files: buildResult.files,
        filesGenerated: Object.keys(buildResult.files).length,
        skillsUsed: buildResult.skillsUsed,
      };
    }

    case 'explain_code':
      return {
        success: true,
        message:
          'You can explore the site in the live preview. Switch to the Code tab if you want to see the files. What would you like to change?',
      };

    default:
      return { success: false, message: `Unknown action: ${tool}` };
  }
}
