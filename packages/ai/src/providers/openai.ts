import {
  parseGenerationResult,
  buildJsonRepairPrompt,
} from '../parse-generation.js';
import type { AiProvider, AiResponse, GenerateOptions, EditOptions } from '../types.js';

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI-compatible provider that works with any OpenAI-wire-format API,
 * including proxies like codex-everywhere.
 */
export class OpenAiProvider implements AiProvider {
  readonly id = 'openai';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-5.5', baseUrl = 'https://api.openai.com') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async generate(options: GenerateOptions): Promise<AiResponse> {
    const messages: OpenAiMessage[] = [];
    if (options.context) {
      messages.push({ role: 'system', content: options.context });
    }
    messages.push({ role: 'user', content: options.prompt });

    const response = await this.call(messages);
    return this.parseResponse(response.content, response.inputTokens, response.outputTokens);
  }

  async edit(options: EditOptions): Promise<AiResponse> {
    const fileContext = Object.entries(options.files)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join('\n\n');

    const userMessage = [
      options.instruction,
      fileContext ? `\nCurrent project files:\n${fileContext}` : '',
    ].filter(Boolean).join('\n');

    const messages: OpenAiMessage[] = [];
    if (options.context) {
      messages.push({ role: 'system', content: options.context });
    }
    messages.push({ role: 'user', content: userMessage });

    const response = await this.call(messages);
    return this.parseResponse(response.content, response.inputTokens, response.outputTokens);
  }

  async call(
    messages: OpenAiMessage[],
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 16384,
        temperature: 0.25,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  /**
   * Chat-style call matching the AnthropicProvider interface for drop-in compatibility.
   */
  async chat(
    systemPrompt: string,
    chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: { jsonMode?: boolean },
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const messages: OpenAiMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of chatMessages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: 16384,
      temperature: 0.4,
    };
    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';

    return {
      content,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  private parseResponse(content: string, inputTokens: number, outputTokens: number): AiResponse {
    try {
      const parsed = parseGenerationResult(content);
      return {
        operations: parsed.operations,
        dependencies: parsed.dependencies,
        buildCommand: parsed.buildCommand,
        tokensUsed: { input: inputTokens, output: outputTokens },
      };
    } catch (err) {
      throw new Error(
        `${err instanceof Error ? err.message : 'Invalid OpenAI response'}. ${buildJsonRepairPrompt(content, String(err))}`,
      );
    }
  }
}
