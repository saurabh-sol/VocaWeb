import { GoogleGenAI } from '@google/genai';
import {
  parseGenerationResult,
  buildJsonRepairPrompt,
} from '../parse-generation.js';
import type { AiProvider, AiResponse, GenerateOptions, EditOptions } from '../types.js';

export class GeminiProvider implements AiProvider {
  readonly id = 'google';
  readonly model: string;
  private client: GoogleGenAI;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generate(options: GenerateOptions): Promise<AiResponse> {
    const systemPrompt = options.context ?? '';
    const response = await this.call(systemPrompt, options.prompt);
    return this.parseResponse(response.text, response.inputTokens, response.outputTokens);
  }

  async edit(options: EditOptions): Promise<AiResponse> {
    const fileContext = Object.entries(options.files)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join('\n\n');

    const userMessage = [
      options.instruction,
      fileContext ? `\nCurrent project files:\n${fileContext}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = options.context ?? '';
    const response = await this.call(systemPrompt, userMessage);
    return this.parseResponse(response.text, response.inputTokens, response.outputTokens);
  }

  private async call(
    systemPrompt: string,
    userMessage: string,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 16384,
        temperature: 0.25,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text ?? '';
    const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    return { text, inputTokens, outputTokens };
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
        `${err instanceof Error ? err.message : 'Invalid Gemini response'}. ${buildJsonRepairPrompt(content, String(err))}`,
      );
    }
  }
}
