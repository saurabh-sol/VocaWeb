/** Every model call goes through the Vercel AI Gateway, so there is one key to manage. */
import type { AiProviderName } from '@theo/ai';

export type { AiProviderName };
export type AiChannel = 'chat' | 'voice';

export function getGatewayKey(): string {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) throw new Error('AI_GATEWAY_API_KEY is not set');
  return key;
}

export function hasGatewayKey(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

/**
 * Model family per task:
 *   openai    → chat and explanations (gpt-5.5)
 *   anthropic → debugging and fixes (claude-sonnet-4-6)
 *   google    → website generation and edits (gemini-2.5-flash)
 */
export function getProviderForTask(taskType: string): AiProviderName {
  switch (taskType) {
    case 'chat':
    case 'explain':
      return 'openai';
    case 'fix':
      return 'anthropic';
    case 'generate':
    case 'edit':
    case 'ui_improve':
    default:
      return 'google';
  }
}

export function getPreferredProviderForChannel(channel: AiChannel = 'chat'): AiProviderName {
  return channel === 'voice' ? 'google' : 'openai';
}
