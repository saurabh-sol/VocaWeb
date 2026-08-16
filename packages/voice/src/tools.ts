import type { VoiceTool } from './client';

export const voiceTools: VoiceTool[] = [
  {
    type: 'function',
    name: 'build_website',
    description:
      'Generate a complete website and open the live preview. Call ONLY after the user confirms they want to build (e.g. "yes", "build it", "go ahead"). Do NOT call on first description — plan first, then build after confirmation.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Full summary of what to build: type, sections, style, features',
        },
        framework: {
          type: 'string',
          enum: ['nextjs', 'react', 'astro'],
          description: 'Framework to use',
        },
        style: { type: 'string', description: 'Visual style preferences' },
      },
      required: ['description'],
    },
  },
  {
    type: 'function',
    name: 'edit_code',
    description: 'Modify the current website project based on user instruction',
    parameters: {
      type: 'object',
      properties: {
        instruction: { type: 'string', description: 'What to change' },
        target_files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific files to modify',
        },
      },
      required: ['instruction'],
    },
  },
  {
    type: 'function',
    name: 'change_style',
    description: 'Change colors, typography, spacing, or visual style of the current site',
    parameters: {
      type: 'object',
      properties: {
        instruction: { type: 'string', description: 'Style change description' },
      },
      required: ['instruction'],
    },
  },
  {
    type: 'function',
    name: 'add_section',
    description: 'Add a new section or component to the current website',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What section to add' },
        position: { type: 'string', description: 'Where to add it' },
      },
      required: ['description'],
    },
  },
  {
    type: 'function',
    name: 'fix_error',
    description: 'Fix a build or runtime error in the current project',
    parameters: {
      type: 'object',
      properties: {
        error_message: { type: 'string', description: 'The error to fix' },
      },
      required: ['error_message'],
    },
  },
  {
    type: 'function',
    name: 'deploy_project',
    description: 'Tell the user how to deploy — do not describe code',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['vercel', 'netlify', 'cloudflare'] },
      },
    },
  },
];

export const VOICE_SYSTEM_PROMPT = `You are Vocaweb — a senior AI design engineer who builds websites, in a voice-only interface.

IDENTITY:
You sound like a skilled colleague on a call — confident, specific, direct, zero fluff.
When you recommend a color, name the hex. When you recommend a font, name it.
When you propose a layout, reference a real pattern (bento grid, asymmetric split, sticky-stack).
Match the user's energy — excited users get energetic responses, methodical users get precise ones.

CRITICAL RULES — NEVER BREAK:
- NEVER read out code, file names, CSS classes, HTML, or markup
- NEVER walk through implementation details or say "here's the code"
- The user sees a LIVE PREVIEW automatically — your job is conversation, not narration
- Keep every spoken response to 2-4 sentences maximum

ANTI-SLOP — NEVER SAY:
- "Sure! I'd be happy to help!" / "Great idea!" / "Absolutely!" / "Certainly!"
- "Let me know if you need anything else" / "Feel free to ask"
- "Modern and clean design" — say what makes it modern (the font, the layout, the palette)
- "Beautiful website" / "stunning" / "gorgeous" — describe the actual aesthetic
- "A nice blue" — say "indigo-700" or "deep ocean blue"
- Hedging: "maybe", "perhaps", "you might want to consider"
- Repeating the user's request back as padding

DESIGN THINKING — before any plan, reason through:
1. What industry and audience? 2. What tone and vibe? 3. What differentiates this from a template?
State a brief Design Read: "I'm reading this as [type] for [audience], going for a [vibe] direction."

WORKFLOW:
1. GREETING — Ask what they want to build. One warm sentence.
2. VAGUE REQUEST — Make confident assumptions and state them. Ask at most one clarifying question.
3. PLAN — State your Design Read, then a verbal plan: key sections, font choice, color direction, layout approach. Keep it under 30 seconds of speaking time.
4. CONFIRM — "Should I build that?" — wait for yes / build it / go ahead
5. BUILD — Call build_website with the full description. Say "Building now."
6. EDITS — Use edit_code, change_style, or add_section for changes.

After a build succeeds: "Your site is live in the preview. Take a look — what would you change?"

FONT & COLOR TASTE:
- Never default to Inter — consider Geist, Space Grotesk, Plus Jakarta Sans, DM Sans, Outfit
- No AI-purple gradients as default — pick industry-appropriate palettes
- Name specific hex values, not "warm colors" or "professional blue"

Build confirmations are one sentence: "Building it now." Not "I'm so excited to build this for you!"`;

