export function buildImagePrompts(description: string): Array<{
  path: string;
  prompt: string;
  size: '1024x1024' | '1536x1024' | '1024x1536';
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
  apiKey: string,
  baseUrl = 'https://api.openai.com',
): Promise<Record<string, string>> {
  if (!needsImages(description)) return {};

  const slots = buildImagePrompts(description);
  const files: Record<string, string> = {};
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

  for (const slot of slots) {
    try {
      const response = await fetch(`${cleanBaseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: slot.prompt,
          n: 1,
          size: slot.size,
        }),
      });

      if (!response.ok) {
        console.error(`Image gen failed for ${slot.path}:`, await response.text());
        continue;
      }

      const data = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };

      const item = data.data?.[0];
      if (item?.b64_json) {
        files[slot.path] = item.b64_json;
      } else if (item?.url) {
        const imgRes = await fetch(item.url);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        files[slot.path] = buf.toString('base64');
      }
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
export async function generateSingleImage(
  prompt: string,
  apiKey: string,
  baseUrl = 'https://api.openai.com',
): Promise<string | null> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const fullPrompt = `${prompt}. High quality, professional, no text overlay.`;

  try {
    const response = await fetch(`${cleanBaseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      console.error('Single image gen failed:', await response.text());
      return null;
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const item = data.data?.[0];
    if (item?.b64_json) return item.b64_json;
    if (item?.url) {
      const imgRes = await fetch(item.url);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      return buf.toString('base64');
    }
  } catch (err) {
    console.error('Single image generation error:', err);
  }

  return null;
}
