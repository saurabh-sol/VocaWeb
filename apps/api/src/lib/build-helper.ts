import type { OrchestratorContext } from './orchestrator.js';
import { runAgenticCodegen } from './agent-loop.js';
import {
  createProject,
  getProjectFileTree,
  persistProjectToDb,
  writeProjectFile,
} from './project-manager.js';
import { generateSiteImages, imagePathsForPrompt } from './image-generator.js';
import { getOpenAiKey } from './ai-keys.js';
import type { AiChannel } from './ai-keys.js';
import { persistBuildLog } from './conversation-store.js';
import type { ConversationTurn } from './conversation-context.js';
import { tierToFramework, type BuildFramework } from './prompts.js';
import type { ModelTier } from './token-gate.js';

export interface BuildProjectResult {
  projectId: string;
  files: Record<string, string>;
  filesGenerated: number;
  provider: string;
  model: string;
  skillsUsed: string[];
  applied: number;
  errors: string[];
}

export async function buildProjectFromDescription(
  description: string,
  options: {
    userId?: string;
    projectId?: string;
    framework?: string;
    modelTier?: string;
    channel?: AiChannel;
    projectName?: string;
    conversationHistory?: ConversationTurn[];
    confirmedPlan?: string;
    importBundle?: import('@theo/shared').ImportBundle;
    useMcp?: boolean;
  } = {},
): Promise<BuildProjectResult> {
  const channel = options.channel ?? 'chat';
  const userId = options.userId ?? 'anonymous';
  const buildFramework: BuildFramework = options.modelTier
    ? tierToFramework(options.modelTier)
    : (options.framework as BuildFramework) ?? 'react-vite';
  const framework = buildFramework;

  let effectiveDescription = description;
  if (options.importBundle) {
    const { mergeImportBundleIntoDescription } = await import('./import-pipeline.js');
    effectiveDescription = mergeImportBundleIntoDescription(
      description,
      options.importBundle,
      options.modelTier as ModelTier | undefined,
    );
  }

  let projectId = options.projectId;
  if (!projectId) {
    const name =
      options.projectName ??
      (effectiveDescription.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Untitled');
    const project = createProject(name, framework);
    projectId = project.id;
  }

  let preGeneratedAssets: Record<string, string> = {};
  if (framework !== 'html') {
    try {
      const imageB64 = await generateSiteImages(effectiveDescription, getOpenAiKey());
      preGeneratedAssets = Object.fromEntries(
        imagePathsForPrompt(imageB64).map((p) => [p, 'generated']),
      );
      for (const [path, b64] of Object.entries(imageB64)) {
        writeProjectFile(projectId, path, b64);
      }
    } catch (err) {
      console.error('Image generation skipped:', err);
    }
  }

  const context: OrchestratorContext = {
    userId,
    projectId,
    channel,
    framework: buildFramework,
    preGeneratedAssets,
    conversationHistory: options.conversationHistory,
    confirmedPlan: options.confirmedPlan,
    useMcp: options.useMcp,
  };

  const buildResult = await runAgenticCodegen(
    'build_website',
    { description: effectiveDescription, framework },
    context,
  );

  const files = buildResult.files;

  if (userId !== 'anonymous') {
    await persistProjectToDb(projectId, userId).catch(() => {});
    await persistBuildLog(
      userId,
      projectId,
      'build_website',
      buildResult.model,
      {
        provider: buildResult.provider,
        filesGenerated: Object.keys(files).length,
        skillsUsed: buildResult.skillsUsed,
        channel,
        agentRounds: buildResult.rounds,
        validationRetries: buildResult.validationRetries,
      },
      {
        input: buildResult.tokensUsed?.input,
        output: buildResult.tokensUsed?.output,
      },
    );
  }

  return {
    projectId,
    files,
    filesGenerated: Object.keys(files).length,
    provider: buildResult.provider,
    model: buildResult.model,
    skillsUsed: buildResult.skillsUsed,
    applied: buildResult.applied,
    errors: buildResult.applyErrors,
  };
}

export async function fixProjectError(
  projectId: string,
  errorMessage: string,
  userId = 'anonymous',
  channel: AiChannel = 'chat',
): Promise<BuildProjectResult> {
  const result = await runAgenticCodegen(
    'fix_error',
    { error_message: errorMessage },
    {
      userId,
      projectId,
      projectFiles: getProjectFileTree(projectId),
      channel,
    },
  );

  const files = result.files;

  if (userId !== 'anonymous') {
    await persistProjectToDb(projectId, userId).catch(() => {});
    await persistBuildLog(
      userId,
      projectId,
      'fix_error',
      result.model,
      {
        provider: result.provider,
        applied: result.applied,
        channel,
        agentRounds: result.rounds,
      },
      {
        input: result.tokensUsed?.input,
        output: result.tokensUsed?.output,
      },
    );
  }

  return {
    projectId,
    files,
    filesGenerated: Object.keys(files).length,
    provider: result.provider,
    model: result.model,
    skillsUsed: result.skillsUsed,
    applied: result.applied,
    errors: result.applyErrors,
  };
}
