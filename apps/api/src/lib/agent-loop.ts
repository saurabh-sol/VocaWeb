import type { GenerationResult } from '@theo/shared';
import { createDefaultSupervisor } from '@theo/ai';
import { orchestrate, type OrchestratorContext, type OrchestratorResult } from './orchestrator.js';
import {
  applyFileOperations,
  getProjectFileTree,
  readProjectFile,
  listProjectFiles,
} from './project-manager.js';
import { executeTool } from './tool-executor.js';
import { validateGenerationResult } from './response-validator.js';
import { mergeProjectDependencies, scanAndMergeMissingDeps } from './dependency-merge.js';
import { patchTailwindV4Config } from './tailwind-patch.js';
import {
  buildIntegrationContextForAgent,
  getConnectedIntegrations,
} from './integration-tools.js';

const MAX_AGENT_ROUNDS = 5;

export interface AgentLoopResult extends OrchestratorResult {
  applied: number;
  applyErrors: string[];
  rounds: number;
  files: Record<string, string>;
}

async function verifyAppliedFiles(projectId: string, errors: string[]): Promise<string[]> {
  const verifyErrors: string[] = [];

  for (const filePath of listProjectFiles(projectId)) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) continue;
    const content = readProjectFile(projectId, filePath);
    if (!content) continue;

    if (content.includes('<<<<<<<') || content.includes('>>>>>>>')) {
      verifyErrors.push(`${filePath}: merge conflict markers detected`);
    }
    const open = (content.match(/[{(]/g) ?? []).length;
    const close = (content.match(/[})]/g) ?? []).length;
    if (Math.abs(open - close) > 2) {
      verifyErrors.push(`${filePath}: possible unbalanced brackets`);
    }
  }

  return [...errors, ...verifyErrors];
}

export async function runAgenticCodegen(
  intent: string,
  args: Record<string, unknown>,
  context: OrchestratorContext,
): Promise<AgentLoopResult> {
  const supervisor = createDefaultSupervisor();
  let lastResult: OrchestratorResult | null = null;
  let applied = 0;
  let applyErrors: string[] = [];
  let rounds = 0;

  let enrichedContext = context;
  if (context.useMcp && context.userId !== 'anonymous') {
    const providers =
      context.connectedIntegrations ?? (await getConnectedIntegrations(context.userId));
    const integrationContext = await buildIntegrationContextForAgent(
      context.userId,
      providers,
    );
    if (integrationContext) {
      enrichedContext = {
        ...context,
        connectedIntegrations: providers,
        confirmedPlan: [context.confirmedPlan, integrationContext].filter(Boolean).join('\n\n'),
      };
    }
  }

  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    rounds = round;

    await executeTool(enrichedContext.projectId, 'file_list', {});

    lastResult = await orchestrate(intent, args, {
      ...enrichedContext,
      projectFiles: getProjectFileTree(enrichedContext.projectId),
    });

    const validation = validateGenerationResult(lastResult.result);
    if (!validation.valid) {
      if (round === MAX_AGENT_ROUNDS) {
        throw new Error(validation.error ?? 'Generation result validation failed');
      }
      args = {
        ...args,
        instruction: `Fix invalid generation output: ${validation.error}`,
      };
      intent = 'fix_error';
      continue;
    }

    const apply = applyFileOperations(enrichedContext.projectId, lastResult.result.operations ?? []);
    applied = apply.applied;
    applyErrors = await verifyAppliedFiles(enrichedContext.projectId, apply.errors);

    const fw = enrichedContext.framework ?? 'react-vite';
    if (fw !== 'html') {
      mergeProjectDependencies(enrichedContext.projectId, lastResult.result.dependencies ?? []);
      scanAndMergeMissingDeps(enrichedContext.projectId);
    }
    if (fw === 'react-vite') {
      patchTailwindV4Config(enrichedContext.projectId);
    }

    if (applyErrors.length === 0) {
      break;
    }

    if (round === MAX_AGENT_ROUNDS) break;

    intent = 'fix_error';
    args = { error_message: applyErrors.join('\n') };
    enrichedContext = {
      ...enrichedContext,
      projectFiles: getProjectFileTree(enrichedContext.projectId),
    };
  }

  if (applyErrors.length > 0 && lastResult) {
    try {
      const fix = await orchestrate(
        'fix_error',
        { error_message: applyErrors.join('\n') },
        { ...enrichedContext, projectFiles: getProjectFileTree(enrichedContext.projectId) },
      );
      const fixApply = applyFileOperations(enrichedContext.projectId, fix.result.operations ?? []);
      applied += fixApply.applied;
      applyErrors = fixApply.errors;
      lastResult = fix;
    } catch {
      // keep prior errors
    }
  }

  if (!lastResult) {
    throw new Error('Agent loop failed to produce a result');
  }

  await supervisor.dispatch({
    id: `verify-${enrichedContext.projectId}`,
    type: 'testing',
    instruction: 'Verify codegen output',
    context: { projectId: enrichedContext.projectId, errors: applyErrors },
  });

  return {
    ...lastResult,
    applied,
    applyErrors,
    rounds,
    files: getProjectFileTree(enrichedContext.projectId),
  };
}

export function toGenerationResult(result: AgentLoopResult): GenerationResult {
  return result.result;
}
