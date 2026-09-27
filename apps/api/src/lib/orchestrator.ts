import { join } from 'path';
import type { GenerationResult } from '@theo/shared';
import {
  GatewayProvider,
  GatewayError,
  DEFAULT_MODELS,
  modelRouter,
  getSkillsForIntent,
  formatSkillsAsContext,
  setSkillsDir,
  buildJsonRepairPrompt,
  type AiProvider,
  type AiResponse,
} from '@theo/ai';
import {
  buildGeneratePromptForFramework,
  buildEditPromptForFramework,
  buildFixPromptForFramework,
  buildUiImprovePromptForFramework,
  detectFrameworkFromFiles,
  type BuildFramework,
} from './prompts.js';
import {
  getGatewayKey,
  getProviderForTask,
  type AiChannel,
  type AiProviderName,
} from './ai-keys.js';
import { selectRelevantFilesForEdit } from './file-selector.js';
import { formatConversationHistory } from './conversation-context.js';
import { validateGenerationResult } from './response-validator.js';

setSkillsDir(join(process.cwd(), '..', '..', 'skills'));

export interface OrchestratorContext {
  userId: string;
  projectId: string;
  projectFiles?: Record<string, string>;
  conversationHistory?: { role: string; content: string }[];
  confirmedPlan?: string;
  preferredProvider?: AiProviderName;
  channel?: AiChannel;
  preGeneratedAssets?: Record<string, string>;
  useMcp?: boolean;
  connectedIntegrations?: import('@theo/shared').IntegrationProvider[];
  framework?: BuildFramework;
}

export interface OrchestratorResult {
  jobType: string;
  model: string;
  provider: string;
  result: GenerationResult;
  tokensUsed: { input: number; output: number };
  skillsUsed: string[];
  validationRetries: number;
}

const EDIT_INTENTS = new Set([
  'edit_code',
  'change_style',
  'add_section',
  'fix_error',
  'ui_improve',
]);

function getModelForProvider(providerName: AiProviderName, taskType: string): string {
  const routing = modelRouter(taskType);
  if (routing.provider === providerName && routing.model !== 'none') {
    return routing.model;
  }
  return DEFAULT_MODELS[providerName] ?? routing.model;
}

/** The task's own fallback goes first, then whichever family is left. */
function getFallbackProviders(primary: AiProviderName, taskType: string): AiProviderName[] {
  const preferred = modelRouter(taskType).fallbackProvider;
  const all: AiProviderName[] = ['google', 'anthropic', 'openai'];
  const ordered = preferred ? [preferred, ...all.filter((p) => p !== preferred)] : all;
  return ordered.filter((p) => p !== primary);
}

/** Bad key, no credit or no access: another model would fail the same way. */
function isAccountError(err: unknown): boolean {
  return err instanceof GatewayError && [401, 402, 403].includes(err.status);
}

async function callWithFallback(
  taskType: string,
  fn: (provider: AiProvider) => Promise<AiResponse>,
  preferredProvider: AiProviderName,
): Promise<{ response: AiResponse; providerUsed: string; modelUsed: string }> {
  const apiKey = getGatewayKey();
  const candidates: AiProviderName[] = [
    preferredProvider,
    ...getFallbackProviders(preferredProvider, taskType),
  ];

  for (const providerName of candidates) {
    const model = getModelForProvider(providerName, taskType);
    try {
      const response = await fn(new GatewayProvider(apiKey, model));
      return { response, providerUsed: providerName, modelUsed: model };
    } catch (err) {
      if (isAccountError(err)) {
        console.error('[orchestrator] AI Gateway rejected the request:', err);
        throw new Error('The AI service is unavailable right now. Please try again later.');
      }
      console.error(`[orchestrator] ${model} failed for ${taskType}, trying the next model:`, err);
    }
  }

  throw new Error(`Every model failed for task: ${taskType}.`);
}

function formatFileContext(files?: Record<string, string>): string {
  if (!files || Object.keys(files).length === 0) return '';
  const entries = Object.entries(files)
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join('\n\n');
  return `\nCurrent project files:\n${entries}`;
}

function getPromptBuilder(intent: string, framework: BuildFramework): (skills: string) => string {
  switch (intent) {
    case 'build_website':
      return (skills) => buildGeneratePromptForFramework(framework, skills);
    case 'edit_code':
    case 'change_style':
    case 'add_section':
      return (skills) => buildEditPromptForFramework(framework, skills);
    case 'fix_error':
      return (skills) => buildFixPromptForFramework(framework, skills);
    case 'ui_improve':
      return (skills) => buildUiImprovePromptForFramework(framework, skills);
    default:
      return (skills) => buildGeneratePromptForFramework(framework, skills);
  }
}

function selectProjectFiles(
  intent: string,
  projectFiles: Record<string, string> | undefined,
  userPrompt: string,
): Record<string, string> {
  if (!projectFiles || Object.keys(projectFiles).length === 0) return {};
  if (!EDIT_INTENTS.has(intent)) return projectFiles;
  return selectRelevantFilesForEdit(projectFiles, userPrompt);
}

function buildUserMessage(
  intent: string,
  args: Record<string, unknown>,
  projectFiles?: Record<string, string>,
  preGeneratedAssets?: Record<string, string>,
  conversationHistory?: OrchestratorContext['conversationHistory'],
  confirmedPlan?: string,
): string {
  const fileContext = formatFileContext(projectFiles);
  const historyContext = formatConversationHistory(conversationHistory);

  let assetContext = '';
  if (preGeneratedAssets && Object.keys(preGeneratedAssets).length > 0) {
    const paths = Object.keys(preGeneratedAssets).join(', ');
    assetContext = `\nPre-generated images available in the project (use next/image with these paths): ${paths}`;
  }

  const planContext = confirmedPlan?.trim()
    ? `\n\nConfirmed build plan:\n${confirmedPlan.trim()}`
    : '';

  switch (intent) {
    case 'build_website': {
      const description = String(args.description ?? '');
      const framework = String(args.framework ?? 'nextjs');
      const style = args.style ? String(args.style) : '';
      return [
        `Create a ${framework} website: ${description}`,
        style ? `Style: ${style}` : '',
        planContext,
        historyContext,
        assetContext,
        fileContext,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'edit_code':
    case 'change_style':
    case 'add_section': {
      const instruction = String(args.instruction ?? args.description ?? '');
      return [`${intent}: ${instruction}`, planContext, historyContext, fileContext]
        .filter(Boolean)
        .join('\n');
    }
    case 'fix_error': {
      const errorMessage = String(args.error_message ?? args.error ?? '');
      return [`Fix this error: ${errorMessage}`, historyContext, fileContext].filter(Boolean).join('\n');
    }
    case 'ui_improve': {
      const instruction = String(args.instruction ?? args.description ?? '');
      return [`Improve the UI: ${instruction}`, planContext, historyContext, fileContext]
        .filter(Boolean)
        .join('\n');
    }
    default:
      return [String(args.description ?? args.instruction ?? ''), historyContext, fileContext]
        .filter(Boolean)
        .join('\n');
  }
}

function intentToTaskType(intent: string): string {
  switch (intent) {
    case 'build_website':
      return 'generate';
    case 'edit_code':
    case 'change_style':
    case 'add_section':
      return 'edit';
    case 'fix_error':
      return 'fix';
    case 'ui_improve':
      return 'ui_improve';
    default:
      return 'generate';
  }
}

export async function orchestrate(
  intent: string,
  args: Record<string, unknown>,
  context: OrchestratorContext,
): Promise<OrchestratorResult> {
  const channel = context.channel ?? 'chat';
  const userPrompt = String(
    args.description ?? args.instruction ?? args.error_message ?? args.error ?? '',
  );

  const framework: BuildFramework =
    context.framework ?? detectFrameworkFromFiles(context.projectFiles);

  const skills = getSkillsForIntent(intent, userPrompt, channel, framework);
  const skillsContext = formatSkillsAsContext(skills);
  const skillNames = skills.map((s) => s.name);

  const promptBuilder = getPromptBuilder(intent, framework);
  const systemPrompt = promptBuilder(skillsContext);

  const projectFiles = selectProjectFiles(intent, context.projectFiles, userPrompt);

  const baseUserMessage = buildUserMessage(
    intent,
    args,
    projectFiles,
    context.preGeneratedAssets,
    context.conversationHistory,
    context.confirmedPlan,
  );

  const taskType = intentToTaskType(intent);
  const provider = context.preferredProvider ?? getProviderForTask(taskType);

  let validationRetries = 0;
  let lastValidationError = 'Invalid generation result';

  for (let attempt = 0; attempt < 2; attempt++) {
    const userMessage =
      attempt === 0
        ? baseUserMessage
        : buildJsonRepairPrompt(baseUserMessage, lastValidationError);

    if (attempt > 0) validationRetries++;

    const { response, providerUsed, modelUsed } = await callWithFallback(
      taskType,
      (prov) => {
        if (intent === 'build_website') {
          return prov.generate({
            prompt: userMessage,
            framework: String(args.framework ?? 'nextjs'),
            context: systemPrompt,
          });
        }
        return prov.edit({
          instruction: userMessage,
          files: projectFiles,
          context: systemPrompt,
        });
      },
      provider,
    );

    const candidate: GenerationResult = {
      operations: response.operations,
      dependencies: response.dependencies,
      buildCommand: response.buildCommand,
    };

    const validation = validateGenerationResult(candidate);
    if (validation.valid) {
      console.info('[orchestrator]', {
        intent,
        provider: providerUsed,
        filesSent: Object.keys(projectFiles).length,
        skillsUsed: skillNames.length,
        validationRetries,
        operations: candidate.operations.length,
      });

      return {
        jobType: taskType,
        model: modelUsed,
        provider: providerUsed,
        result: candidate,
        tokensUsed: response.tokensUsed,
        skillsUsed: skillNames,
        validationRetries,
      };
    }

    lastValidationError = validation.error ?? lastValidationError;
  }

  throw new Error(lastValidationError);
}
