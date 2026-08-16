import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  framework: z.enum(['nextjs', 'react', 'astro']).default('nextjs'),
  description: z.string().max(2000).optional(),
});

export const generateRequestSchema = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(5000),
  model: z.enum(['claude-sonnet-4-6', 'claude-opus-4-8', 'gemini-3.5-flash', 'gemini-3.5-pro']).default('claude-sonnet-4-6'),
});

export const editRequestSchema = z.object({
  projectId: z.string().uuid(),
  instruction: z.string().min(1).max(5000),
  targetFiles: z.array(z.string()).optional(),
});

export const fileOperationSchema = z.object({
  action: z.enum(['create', 'replace', 'delete']),
  path: z.string().min(1),
  content: z.string().optional(),
  search: z.string().optional(),
  replace: z.string().optional(),
});

export const generationResultSchema = z.object({
  operations: z.array(fileOperationSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  buildCommand: z.string().default('npm run build'),
});

export const chatStructuredResponseSchema = z.object({
  intent: z.enum([
    'greeting',
    'ask_info',
    'plan_ready',
    'build_website',
    'edit_code',
    'generate_image',
    'import_sources',
    'general',
  ]),
  reply: z.string(),
  shouldBuild: z.boolean().default(false),
  plan: z.string().optional(),
  imagePrompt: z.string().optional(),
});

export const integrationProviderSchema = z.enum(['notion', 'canva', 'figma']);

export const importSourceSchema = z.object({
  provider: integrationProviderSchema,
  externalId: z.string().min(1),
  title: z.string().optional(),
  url: z.string().optional(),
  frameId: z.string().optional(),
  format: z.enum(['png', 'html_standalone', 'html_bundle', 'pdf']).optional(),
});

export const importBundleSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.number().int().min(1).max(6),
  body: z.string(),
  bullets: z.array(z.string()).optional(),
});

export const importBundleSchema = z.object({
  sources: z.array(
    z.object({
      provider: integrationProviderSchema,
      externalId: z.string(),
      title: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
  markdownContent: z.string().optional(),
  assets: z
    .array(
      z.object({
        path: z.string(),
        url: z.string().optional(),
        mime: z.string().optional(),
        projectPath: z.string().optional(),
      }),
    )
    .optional(),
  designTokens: z
    .object({
      colors: z.array(z.string()).optional(),
      fonts: z.array(z.string()).optional(),
      spacing: z.array(z.number()).optional(),
    })
    .optional(),
  structuredSections: z.array(importBundleSectionSchema).optional(),
  layoutSummary: z.string().optional(),
});

export const importRequestSchema = z.object({
  sources: z.array(importSourceSchema).min(1),
  projectId: z.string().uuid().optional(),
  useMcp: z.boolean().optional().default(false),
});

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type ImportSource = z.infer<typeof importSourceSchema>;
export type ImportBundle = z.infer<typeof importBundleSchema>;
export type ImportBundleSection = z.infer<typeof importBundleSectionSchema>;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;
export type EditRequestInput = z.infer<typeof editRequestSchema>;
export type GenerationResultValidated = z.infer<typeof generationResultSchema>;
export type ChatStructuredResponse = z.infer<typeof chatStructuredResponseSchema>;
