import {
  parseGenerationResult,
  buildJsonRepairPrompt,
} from '../parse-generation.js';
import type { AiProvider, AiResponse, GenerateOptions, EditOptions } from '../types.js';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6', baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
  }

  async generate(options: GenerateOptions): Promise<AiResponse> {
    const messages: ClaudeMessage[] = [
      { role: 'user', content: options.prompt },
    ];

    const response = await this.call(options.context ?? '', messages);
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

    const messages: ClaudeMessage[] = [
      { role: 'user', content: userMessage },
    ];

    const response = await this.call(options.context ?? '', messages);
    return this.parseResponse(response.content, response.inputTokens, response.outputTokens);
  }

  async call(
    systemPrompt: string,
    messages: ClaudeMessage[],
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 16384,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      content: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const textContent = data.content.find((c) => c.type === 'text');

    return {
      content: textContent?.text ?? '',
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
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
        `${err instanceof Error ? err.message : 'Invalid Claude response'}. ${buildJsonRepairPrompt(content, String(err))}`,
      );
    }
  }
}
