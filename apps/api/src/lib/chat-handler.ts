import { GatewayProvider, extractJsonObject, modelRouter } from '@theo/ai';
import { getChatSkills, formatSkillsAsContext, setSkillsDir } from '@theo/ai';
import { chatStructuredResponseSchema } from '@theo/shared';
import { getGatewayKey } from './ai-keys.js';
import { PLATFORM_LIMITS, PLATFORM_LIMITS_HTML, tierToFramework } from './prompts.js';
import type { ModelTier } from './model-tier.js';
import { join } from 'path';
import {
  isStandaloneImageRequest,
  extractImagePrompt,
  generateSingleImage,
} from './image-generator.js';

setSkillsDir(join(process.cwd(), '..', '..', 'skills'));

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatIntent =
  | 'greeting'
  | 'ask_info'
  | 'plan_ready'
  | 'build_website'
  | 'edit_code'
  | 'generate_image'
  | 'import_sources'
  | 'general';

interface ChatResponse {
  intent: ChatIntent;
  reply: string;
  shouldBuild: boolean;
  plan?: string;
  images?: string[];
}

export interface HandleChatOptions {
  modelTier?: ModelTier;
}

const CHAT_JSON_INSTRUCTION = `
Respond with ONLY valid JSON (no markdown fences) using this exact shape:
{
  "intent": "greeting|ask_info|plan_ready|build_website|edit_code|generate_image|import_sources|general",
  "reply": "user-facing message",
  "shouldBuild": false,
  "plan": "optional structured plan text when intent is plan_ready",
  "imagePrompt": "optional when intent is generate_image"
}

Rules:
- intent=plan_ready when presenting a build plan; put the full plan in "plan"
- intent=build_website with shouldBuild=true only after explicit user confirmation
- intent=generate_image for standalone image requests; set imagePrompt
- intent=import_sources when user wants to import from Notion, Canva, or Figma
- Use markdown formatting in "reply" and "plan": **bold** for key terms, *italic* for emphasis, bullet lists, numbered lists. Keep it readable.
`;

function tierPlanInstructions(tier: ModelTier): {
  framework: string;
  limits: string;
  forbidden: string;
} {
  switch (tier) {
    case 'v1':
      return {
        framework:
          'Plain HTML + CSS + JavaScript (single index.html file, no npm, no React, no Next.js)',
        limits: PLATFORM_LIMITS_HTML,
        forbidden:
          'FORBIDDEN in v1 plans: never mention Next.js, React, Vite, npm, Tailwind, shadcn, Framer Motion, or multi-file projects. Use "CSS transitions/animations" and "vanilla JavaScript" instead.',
      };
    case 'v3':
      return {
        framework: 'Next.js 14 + Tailwind CSS 3',
        limits: PLATFORM_LIMITS,
        forbidden: '',
      };
    case 'v2':
    default:
      return {
        framework: 'React + Vite + Tailwind CSS 4',
        limits: PLATFORM_LIMITS,
        forbidden: '',
      };
  }
}

function buildChatSystemBase(tier: ModelTier): string {
  const { framework, limits, forbidden } = tierPlanInstructions(tier);
  const forbiddenBlock = forbidden ? `\n   - ${forbidden}` : '';

  return `You are VocaWeb, a senior AI design engineer who builds websites. You operate in PLAN mode and BUILD mode.

ACTIVE MODEL TIER: ${tier}
All build plans MUST use this tier's framework — do not plan for a different stack.

HOW TO RESPOND — follow these rules strictly:

1. GREETINGS / CASUAL TALK
   If the user says "hi", "hello", "hey", etc., respond warmly and briefly — ask what kind of website they want. Do NOT plan or build. Keep it to 1-2 sentences.

2. VAGUE REQUESTS
   Make confident assumptions based on the industry and state them. Produce a plan with your assumptions rather than asking multiple questions.
   Ask at most ONE clarifying question only if proceeding would clearly go the wrong direction.

3. CLEAR REQUESTS → PRESENT A PLAN
   When the user gives enough detail, produce a structured build plan in the JSON "plan" field:
   - Start with a Design Read: "Reading this as: [page kind] for [audience], [vibe], leaning [design direction]"
   - Project name (creative, relevant)
   - Type (landing page / portfolio / e-commerce / etc.)
   - Framework: ${framework}${forbiddenBlock}
   - Typography: specific font names with weights and reasoning
   - Color palette: 4-5 hex values with roles (primary, accent, bg, text, muted)
   - Sections with descriptions and design details
   - Features (responsive strategy, animations, dark mode, SEO)
   Set intent to plan_ready and ask if they want to build or change anything.

4. USER CONFIRMS THE PLAN
   If the user confirms ("yes", "build it", "go ahead", "looks good"), set intent=build_website, shouldBuild=true, and reply with ONE short sentence like "Building TaskFlow now."

5. USER WANTS CHANGES TO PLAN
   Update the plan and return intent=plan_ready with the revised plan. Reference what stays the same.

6. GENERAL QUESTIONS
   Answer helpfully and directly about features, pricing, how VocaWeb works, etc.

7. IMAGES — VocaWeb CAN generate real images
   - During website builds, VocaWeb automatically generates custom AI images.
   - NEVER say you cannot generate images.
   - Standalone image requests: intent=generate_image with imagePrompt set.

When planning, stay within platform capabilities:
${limits}
If the user asks for something outside these limits (real auth, database, native app, 20+ page dashboard), be direct about the limitation and immediately propose a frontend-only alternative.

${CHAT_JSON_INSTRUCTION}`;
}

const _chatPromptCache = new Map<ModelTier, string>();

function buildChatSystemPrompt(tier: ModelTier): string {
  const cached = _chatPromptCache.get(tier);
  if (cached) return cached;

  const framework = tierToFramework(tier);
  const skills = getChatSkills(undefined, framework);
  const skillsContext = formatSkillsAsContext(skills);
  const base = buildChatSystemBase(tier);
  const prompt = skillsContext ? `${base}\n${skillsContext}` : base;
  _chatPromptCache.set(tier, prompt);
  return prompt;
}

async function callChatProvider(
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<{ content: string }> {
  const routing = modelRouter('chat');
  const apiKey = getGatewayKey();

  try {
    const provider = new GatewayProvider(apiKey, routing.model);
    const result = await provider.chat(systemPrompt, messages, { jsonMode: true });
    return { content: result.content };
  } catch (err) {
    if (!routing.fallback) throw err;
    console.error(`[chat-handler] ${routing.model} failed, falling back to ${routing.fallback}:`, err);
  }

  const provider = new GatewayProvider(apiKey, routing.fallback);
  const result = await provider.chat(systemPrompt, messages, { jsonMode: true });
  return { content: result.content };
}

function parseStructuredChatResponse(content: string): ChatResponse | null {
  const json = extractJsonObject(content);
  if (!json) return null;

  try {
    const parsed = chatStructuredResponseSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;

    return {
      intent: parsed.data.intent as ChatIntent,
      reply: parsed.data.reply.trim(),
      shouldBuild: parsed.data.shouldBuild,
      plan: parsed.data.plan ? parsed.data.plan.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function parseLegacyChatResponse(content: string, messages: ChatMessage[]): ChatResponse {
  const reply = content.trim();
  const shouldBuild = reply.includes('[BUILD_READY]');
  const hasPlan = reply.includes('[PLAN_START]') && reply.includes('[PLAN_END]');

  let plan: string | undefined;
  let cleanReply = reply;

  if (hasPlan) {
    const planMatch = reply.match(/\[PLAN_START\]([\s\S]*?)\[PLAN_END\]/);
    if (planMatch) {
      plan = planMatch[1].trim();
      cleanReply = reply.replace(/\[PLAN_START\][\s\S]*?\[PLAN_END\]/, '').trim();
    }
  }

  cleanReply = cleanReply.replace('[BUILD_READY]', '').trim();

  let intent: ChatIntent = 'general';
  const lastUser = messages[messages.length - 1]?.content?.toLowerCase() ?? '';

  if (/^(hi|hello|hey|sup|yo|what'?s up|how are you|good morning|good evening)/i.test(lastUser.trim())) {
    intent = 'greeting';
  } else if (shouldBuild) {
    intent = 'build_website';
  } else if (hasPlan) {
    intent = 'plan_ready';
  } else if (cleanReply.includes('?')) {
    intent = 'ask_info';
  }

  return { intent, reply: cleanReply, shouldBuild, plan: plan ?? undefined };
}

export function detectImportSourcesIntent(message: string): boolean {
  return /\b(notion|canva|figma|import (from|my)|design stack|build from my|figma file|canva design)\b/i.test(
    message,
  );
}

export async function handleChat(
  messages: ChatMessage[],
  options: HandleChatOptions = {},
): Promise<ChatResponse> {
  const modelTier = options.modelTier ?? 'v1';
  const lastUserMsg = messages[messages.length - 1]?.content ?? '';
  const isImageRequest = isStandaloneImageRequest(lastUserMsg);

  if (isImageRequest) {
    return {
      intent: 'generate_image',
      reply: lastUserMsg,
      shouldBuild: false,
    };
  }

  if (detectImportSourcesIntent(lastUserMsg)) {
    const viaMcp = /\bvia mcp\b|\bmcp\b.*\bimport\b/i.test(lastUserMsg);
    return {
      intent: 'import_sources',
      reply: viaMcp
        ? 'I can import via MCP for richer context from Notion, Canva, or Figma. Open Import from sources, enable Use MCP for richer context, pick your sources, then build.'
        : 'I can build from your Notion docs, Canva designs, or Figma files. Use Import from sources in chat to connect your accounts and pick what to import — then I\'ll generate a site that matches your content and design.',
      shouldBuild: false,
    };
  }

  const { content } = await callChatProvider(buildChatSystemPrompt(modelTier), messages);
  const structured = parseStructuredChatResponse(content);
  if (structured) return structured;

  return parseLegacyChatResponse(content, messages);
}

export async function handleImageGeneration(userMessage: string): Promise<ChatResponse | null> {
  if (!isStandaloneImageRequest(userMessage)) return null;

  const imagePrompt = extractImagePrompt(userMessage);
  const b64 = await generateSingleImage(imagePrompt);

  if (!b64) {
    return {
      intent: 'generate_image',
      reply:
        "I couldn't generate that image right now. Please try again in a moment.",
      shouldBuild: false,
    };
  }

  const dataUrl = `data:image/jpeg;base64,${b64}`;
  const label = imagePrompt.length > 60 ? `${imagePrompt.slice(0, 60)}...` : imagePrompt;

  return {
    intent: 'generate_image',
    reply: `Here's your image: ${label}. Want me to build it into a full website?`,
    shouldBuild: false,
    images: [dataUrl],
  };
}
