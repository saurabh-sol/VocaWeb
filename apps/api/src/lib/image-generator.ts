import { GATEWAY_BASE_URL, toGatewayModelId } from '@theo/ai';
import { getGatewayKey } from './ai-keys.js';

const IMAGE_MODEL = toGatewayModelId('gpt-image-1');

type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';

/** One image through the AI Gateway, returned as base64. Null when nothing came back. */
async function requestImage(prompt: string, size: ImageSize): Promise<string | null> {
  const response = await fetch(`${GATEWAY_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGatewayKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, n: 1, size }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const item = data.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const imageResponse = await fetch(item.url);
    return Buffer.from(await imageResponse.arrayBuffer()).toString('base64');
  }
  return null;
}

export function buildImagePrompts(description: string): Array<{
  path: string;
  prompt: string;
  size: ImageSize;
}> {
  const base = description.slice(0, 400);
  return [
    {
      path: 'public/images/hero.jpg',
      prompt: `Website hero image for: ${base}. High quality, professional, no text overlay.`,
      size: '1536x1024',
    },
    {
      path: 'public/images/feature-1.jpg',
      prompt: `Feature section image for: ${base}. Clean product or lifestyle shot.`,
      size: '1024x1024',
    },
    {
      path: 'public/images/feature-2.jpg',
      prompt: `Secondary visual for: ${base}. Complementary style to hero.`,
      size: '1024x1024',
    },
  ];
}

function needsImages(description: string): boolean {
  const lower = description.toLowerCase();
  return (
    /image|photo|picture|visual|hero|gallery|product|shop|store|portfolio|restaurant|hotel|travel|brand/i.test(
      lower,
    ) || lower.length > 40
  );
}

export async function generateSiteImages(
  description: string,
): Promise<Record<string, string>> {
  if (!needsImages(description)) return {};

  const files: Record<string, string> = {};

  for (const slot of buildImagePrompts(description)) {
    try {
      const b64 = await requestImage(slot.prompt, slot.size);
      if (b64) files[slot.path] = b64;
    } catch (err) {
      console.error(`Image generation error for ${slot.path}:`, err);
    }
  }

  return files;
}

export function imagePathsForPrompt(imageBase64: Record<string, string>): string[] {
  return Object.keys(imageBase64);
}

/** Detect standalone image requests (not full website builds) */
export function isStandaloneImageRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^(create|make|generate|draw|design|show me|give me|get me|i need|can you create)\s+(an?\s+)?(image|photo|picture|pic|illustration|logo|icon|graphic)/i.test(t)) {
    return true;
  }
  if (/^(an?\s+)?(image|photo|picture|pic|illustration)\s+of\s+/i.test(t)) {
    return true;
  }
  if (/generate.*(image|photo|picture)/i.test(t) && !/website|site|page|landing|portfolio/i.test(t)) {
    return true;
  }
  return false;
}

export function extractImagePrompt(text: string): string {
  const cleaned = text
    .trim()
    .replace(
      /^(create|make|generate|draw|design|show me|give me|get me|i need|can you create)\s+(an?\s+)?(image|photo|picture|pic|illustration|logo|icon|graphic)\s+(of|for|about|showing|with)?\s*/i,
      '',
    )
    .replace(/^(an?\s+)?(image|photo|picture|pic|illustration)\s+of\s+/i, '')
    .trim();
  return cleaned || text.trim();
}

/** Generate a single image for chat responses */
export async function generateSingleImage(prompt: string): Promise<string | null> {
  try {
    return await requestImage(
      `${prompt}. High quality, professional, no text overlay.`,
      '1024x1024',
    );
  } catch (err) {
    console.error('Single image generation error:', err);
    return null;
  }
}
