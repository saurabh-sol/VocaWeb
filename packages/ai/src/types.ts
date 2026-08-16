import type { FileOperation } from '@theo/shared';

export interface GenerateOptions {
  prompt: string;
  framework: string;
  context?: string;
}

export interface EditOptions {
  instruction: string;
  files: Record<string, string>;
  context?: string;
}

export interface AiResponse {
  operations: FileOperation[];
  dependencies: string[];
  buildCommand: string;
  tokensUsed: { input: number; output: number };
}

export interface AiProvider {
  id: string;
  generate(options: GenerateOptions): Promise<AiResponse>;
  edit(options: EditOptions): Promise<AiResponse>;
}
