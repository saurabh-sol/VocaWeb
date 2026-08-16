export type ProjectFramework = 'nextjs' | 'react' | 'astro';
export type ProjectStatus = 'creating' | 'ready' | 'building' | 'error' | 'archived';
export type DeploymentPlatform = 'vercel' | 'netlify' | 'cloudflare';
export type DeploymentStatus = 'queued' | 'building' | 'ready' | 'error' | 'cancelled';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobType = 'generate' | 'edit' | 'fix' | 'deploy';
export type VoiceId = 'eve' | 'ara' | 'rex' | 'sal' | 'leo';
export type AiModel = 'claude-sonnet-4-6' | 'claude-opus-4-8' | 'gemini-3.5-flash' | 'gemini-3.5-pro';

export interface Project {
  id: string;
  name: string;
  framework: ProjectFramework;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceSession {
  id: string;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
}

export interface AiJob {
  id: string;
  type: JobType;
  status: JobStatus;
  projectId: string;
  model: AiModel;
  progress: number;
  result: unknown;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface FileOperation {
  action: 'create' | 'replace' | 'delete';
  path: string;
  content?: string;
  search?: string;
  replace?: string;
}

export interface GenerationResult {
  operations: FileOperation[];
  dependencies: string[];
  buildCommand: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  plan: 'free' | 'pro' | 'team';
  createdAt: Date;
}
