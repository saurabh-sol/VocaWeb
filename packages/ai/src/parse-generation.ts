import { generationResultSchema } from '@theo/shared';
import type { GenerationResult } from '@theo/shared';
import type { ZodError } from 'zod';

export function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // fall through to regex extraction
    }
  }

  const match = text.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

export function parseGenerationResult(content: string): GenerationResult {
  const json = extractJsonObject(content);
  if (!json) {
    throw new Error('No JSON found in AI response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Malformed JSON in AI response');
  }

  const result = generationResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

export function validateGenerationResult(result: GenerationResult): {
  valid: boolean;
  error?: string;
} {
  const parsed = generationResultSchema.safeParse(result);
  if (!parsed.success) {
    return { valid: false, error: formatZodError(parsed.error) };
  }
  return { valid: true };
}

export function buildJsonRepairPrompt(rawContent: string, validationError: string): string {
  return [
    'Your previous response was invalid JSON or did not match the required schema.',
    `Validation error: ${validationError}`,
    'Return ONLY a valid JSON object with this exact shape:',
    '{"operations":[{"action":"create|replace|delete","path":"...","content":"...","search":"...","replace":"..."}],"dependencies":[],"buildCommand":"npm run build"}',
    'Previous invalid response:',
    rawContent.slice(0, 4000),
  ].join('\n\n');
}

function formatZodError(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
