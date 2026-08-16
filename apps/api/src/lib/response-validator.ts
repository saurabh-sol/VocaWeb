import {
  parseGenerationResult,
  validateGenerationResult,
  buildJsonRepairPrompt,
  extractJsonObject,
} from '@theo/ai';
import type { GenerationResult } from '@theo/shared';

export { parseGenerationResult, validateGenerationResult, buildJsonRepairPrompt, extractJsonObject };

export function normalizeGenerationResult(raw: unknown): GenerationResult {
  if (typeof raw === 'string') {
    return parseGenerationResult(raw);
  }
  const validation = validateGenerationResult(raw as GenerationResult);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid generation result');
  }
  return raw as GenerationResult;
}
