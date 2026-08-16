import type { JobType } from '@theo/shared';

interface ModelConfig {
  model: string;
  provider: 'anthropic' | 'google' | 'codex';
  fallback?: string;
  fallbackProvider?: 'anthropic' | 'google' | 'codex';
}

/**
 * Task → Provider routing:
 *   Chat / responses  →  Codex (gpt-5.5)
 *   Debug / fix       →  Anthropic (claude-sonnet-4-6)
 *   Website generate  →  Google/Gemini (gemini-2.5-flash)
 *   Image generation  →  OpenAI (handled separately in image-generator)
 */
const routingTable: Record<string, ModelConfig> = {
  generate:   { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'gpt-5.5',           fallbackProvider: 'codex' },
  edit:       { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
  fix:        { model: 'claude-sonnet-4-6',  provider: 'anthropic', fallback: 'gemini-2.5-flash',  fallbackProvider: 'google' },
  deploy:     { model: 'none',               provider: 'google' },
  explain:    { model: 'gpt-5.5',            provider: 'codex',     fallback: 'gemini-2.5-flash',  fallbackProvider: 'google' },
  ui_improve: { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
  chat:       { model: 'gpt-5.5',            provider: 'codex',     fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
};

export function modelRouter(taskType: string): ModelConfig {
  return routingTable[taskType] ?? routingTable.generate;
}

export function getFallbackModel(taskType: string): string | undefined {
  return routingTable[taskType]?.fallback;
}
