export interface DbUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  email_verified: boolean;
  plan: 'free' | 'pro' | 'team';
  clerk_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbAccount {
  id: string;
  user_id: string;
  account_id: string;
  provider_id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  scope: string | null;
  id_token: string | null;
  password: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  framework: string;
  status: string;
  storage_url: string | null;
  custom_domain: string | null;
  vercel_project_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  content_hash: string | null;
  size: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbProjectVersion {
  id: string;
  project_id: string;
  version: number;
  snapshot_url: string;
  message: string | null;
  created_at: Date;
}

export interface DbVoiceSession {
  id: string;
  user_id: string;
  project_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  duration_seconds: number;
  transcript: Record<string, unknown> | null;
  token_usage: Record<string, unknown> | null;
}

export interface DbAiGeneration {
  id: string;
  user_id: string;
  project_id: string;
  job_type: string;
  model: string;
  status: string;
  prompt_hash: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  duration_ms: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface DbDeployment {
  id: string;
  project_id: string;
  platform: string;
  status: string;
  url: string | null;
  domain: string | null;
  custom_domain: string | null;
  env_vars: Record<string, unknown> | null;
  build_logs: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface DbBillingUsage {
  id: string;
  user_id: string;
  period_start: Date;
  period_end: Date;
  voice_minutes: number;
  ai_tokens_input: number;
  ai_tokens_output: number;
  storage_bytes: bigint;
  deployments_count: number;
  created_at: Date;
  updated_at: Date;
}
