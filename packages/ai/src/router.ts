export type AiProviderName = 'google' | 'anthropic' | 'openai';

interface ModelConfig {
  model: string;
  provider: AiProviderName;
  fallback?: string;
  fallbackProvider?: AiProviderName;
}

/**
 * Task → model routing. Every model is reached through the Vercel AI Gateway;
 * `provider` names the model family for logs and fallback order.
 *   Chat / responses  →  OpenAI (gpt-5.5)
 *   Debug / fix       →  Anthropic (claude-sonnet-4-6)
 *   Website generate  →  Google (gemini-2.5-flash)
 *   Image generation  →  OpenAI gpt-image-1 (handled in image-generator)
 */
const routingTable: Record<string, ModelConfig> = {
  generate:   { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'gpt-5.5',           fallbackProvider: 'openai' },
  edit:       { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
  fix:        { model: 'claude-sonnet-4-6',  provider: 'anthropic', fallback: 'gemini-2.5-flash',  fallbackProvider: 'google' },
  deploy:     { model: 'none',               provider: 'google' },
  explain:    { model: 'gpt-5.5',            provider: 'openai',    fallback: 'gemini-2.5-flash',  fallbackProvider: 'google' },
  ui_improve: { model: 'gemini-2.5-flash',   provider: 'google',    fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
  chat:       { model: 'gpt-5.5',            provider: 'openai',    fallback: 'claude-sonnet-4-6', fallbackProvider: 'anthropic' },
};

/** The model each family uses when it is asked to step in for another. */
export const DEFAULT_MODELS: Record<AiProviderName, string> = {
  google: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.5',
};

export function modelRouter(taskType: string): ModelConfig {
  return routingTable[taskType] ?? routingTable.generate;
}

export function getFallbackModel(taskType: string): string | undefined {
  return routingTable[taskType]?.fallback;
}
