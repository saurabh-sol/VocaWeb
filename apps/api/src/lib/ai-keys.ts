/** Resolve API keys with legacy .env alias support */

export type AiChannel = 'chat' | 'voice';

/**
 * Provider routing:
 *   codex     → Chat & responses (gpt-5.5 via codex-everywhere)
 *   anthropic → Debug / code fix (claude-sonnet-4-6)
 *   google    → Website generation (gemini-2.5-flash)
 *   (OpenAI direct → Image generation only)
 */
export type AiProviderName = 'anthropic' | 'google' | 'codex';

// ── Anthropic (debug / code fix) ─────────────────────────────
export function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  return key;
}

export function getAnthropicBaseUrl(): string | undefined {
  return undefined; // direct Anthropic, no proxy
}

// ── Codex Everywhere (chat & responses) ──────────────────────
export function getCodexKey(): string {
  const key = process.env.CODEX_API_KEY?.trim();
  if (!key) throw new Error('CODEX_API_KEY not set');
  return key;
}

export function getCodexBaseUrl(): string {
  return (process.env.CODEX_BASE_URL?.trim() ?? 'https://codex-everywhere.com').replace(/\/+$/, '');
}

export function getCodexModel(): string {
  return process.env.CODEX_MODEL?.trim() ?? 'gpt-5.5';
}

// ── Google / Gemini (website generation) ─────────────────────
export function getGeminiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() ??
    process.env.ANTIGRAVITY_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return key;
}

/** @deprecated alias kept for backward compat */
export function getAntigravityKey(): string {
  return getGeminiKey();
}

// ── OpenAI (image generation only) ───────────────────────────
export function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY not set');
  return key;
}

// ── Provider resolution per task type ────────────────────────
export function getProviderForTask(taskType: string): AiProviderName {
  switch (taskType) {
    case 'chat':
    case 'explain':
      return 'codex';
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
  return channel === 'voice' ? 'google' : 'codex';
}
