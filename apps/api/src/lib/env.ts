import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Optional. Only the conversation cache uses Redis.
  REDIS_URL: z.string().optional(),

  // Sign-in (Clerk). CLERK_JWT_KEY lets tokens be verified without a network call.
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),

  INTEGRATION_TOKEN_SECRET: z.string().optional(),

  // Every text and image model is reached through the Vercel AI Gateway.
  // Optional at boot so sign-in and projects work while the key is being set up.
  AI_GATEWAY_API_KEY: z.string().optional(),
  FREE_DAILY_BUILDS: z.coerce.number().int().positive().optional(),

  // Realtime voice talks to xAI directly.
  XAI_API_KEY: z.string().optional(),

  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('theo-projects'),
  R2_ENDPOINT: z.string().optional(),

  VERCEL_TOKEN: z.string().optional(),
  DEPLOY_BASE_DOMAIN: z.string().optional(),
  WEB_APP_URL: z.string().optional(),

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
  if (!result.data.AI_GATEWAY_API_KEY?.trim()) {
    console.warn('AI_GATEWAY_API_KEY is not set. Chat, builds and images will fail until it is.');
  }
  return result.data;
}
