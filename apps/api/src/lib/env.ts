import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, 'NEXT_PUBLIC_PRIVY_APP_ID is required'),
  PRIVY_APP_SECRET: z.string().min(1, 'PRIVY_APP_SECRET is required'),

  INTEGRATION_TOKEN_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),

  XAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CODEX_API_KEY: z.string().optional(),
  CODEX_BASE_URL: z.string().optional(),
  CODEX_MODEL: z.string().optional(),
  ANTIGRAVITY_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('theo-projects'),
  R2_ENDPOINT: z.string().optional(),

  VERCEL_TOKEN: z.string().optional(),
  DEPLOY_BASE_DOMAIN: z.string().optional(),

  HELIUS_RPC_URL: z.string().optional(),
  DROOP_TOKEN_MINT: z.string().optional(),

  VOCAWEB_SDK_API_KEY: z.string().optional(),
  VOCAWEB_SDK_API_KEYS: z.string().optional(),
  DROOPER_SDK_API_KEY: z.string().optional(),
  DROOPER_SDK_API_KEYS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
      console.error(`  ${key}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }
  return result.data;
}
