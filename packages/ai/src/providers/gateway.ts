import {
  parseGenerationResult,
  buildJsonRepairPrompt,
} from '../parse-generation.js';
import type { AiProvider, AiResponse, GenerateOptions, EditOptions } from '../types.js';

/** Vercel AI Gateway, spoken to through its OpenAI-compatible API. */
export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

/** Our short model names mapped to the gateway's `creator/model` ids. */
const GATEWAY_MODEL_IDS: Record<string, string> = {
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4.6',
  'gpt-5.5': 'openai/gpt-5.5',
  'gpt-image-1': 'openai/gpt-image-1',
};

export function toGatewayModelId(model: string): string {
  if (model.includes('/')) return model;
  return GATEWAY_MODEL_IDS[model] ?? model;
}

interface GatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GatewayCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GatewayProviderOptions {
  baseUrl?: string;
  /** Aborts a request that runs longer than this. */
  timeoutMs?: number;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

const MAX_OUTPUT_TOKENS = 16384;

export class GatewayProvider implements AiProvider {
  readonly id = 'gateway';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, model: string, options: GatewayProviderOptions = {}) {
    this.apiKey = apiKey;
    this.model = toGatewayModelId(model);
    this.baseUrl = (options.baseUrl ?? GATEWAY_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 180_000;
  }

  async generate(options: GenerateOptions): Promise<AiResponse> {
    const messages: GatewayMessage[] = [];
    if (options.context) messages.push({ role: 'system', content: options.context });
    messages.push({ role: 'user', content: options.prompt });

    const response = await this.complete(messages, { jsonMode: true, temperature: 0.25 });
    return this.parseResponse(response);
  }

  async edit(options: EditOptions): Promise<AiResponse> {
    const fileContext = Object.entries(options.files)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join('\n\n');

    const userMessage = [
      options.instruction,
      fileContext ? `\nCurrent project files:\n${fileContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const messages: GatewayMessage[] = [];
    if (options.context) messages.push({ role: 'system', content: options.context });
    messages.push({ role: 'user', content: userMessage });

    const response = await this.complete(messages, { jsonMode: true, temperature: 0.25 });
    return this.parseResponse(response);
  }

  /** Conversational call used by the chat handler. */
  async chat(
    systemPrompt: string,
    chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: { jsonMode?: boolean } = {},
  ): Promise<GatewayCallResult> {
    const messages: GatewayMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const message of chatMessages) {
      messages.push({ role: message.role, content: message.content });
    }
    return this.complete(messages, { jsonMode: options.jsonMode, temperature: 0.4 });
  }

  private async complete(
    messages: GatewayMessage[],
    options: { jsonMode?: boolean; temperature: number },
  ): Promise<GatewayCallResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: options.temperature,
    };
    if (options.jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new GatewayError(
        `AI Gateway error ${response.status} for ${this.model}: ${detail}`,
        response.status,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  private parseResponse(result: GatewayCallResult): AiResponse {
    try {
      const parsed = parseGenerationResult(result.content);
      return {
        operations: parsed.operations,
        dependencies: parsed.dependencies,
        buildCommand: parsed.buildCommand,
        tokensUsed: { input: result.inputTokens, output: result.outputTokens },
      };
    } catch (err) {
      throw new Error(
        `${err instanceof Error ? err.message : 'Invalid model response'}. ${buildJsonRepairPrompt(result.content, String(err))}`,
      );
    }
  }
}
