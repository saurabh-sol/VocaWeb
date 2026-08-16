import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Skill {
  name: string;
  filename: string;
  content: string;
  score: number;
}

export type BuildFramework = 'html' | 'react-vite' | 'nextjs';

const MAX_SKILLS_CHARS = 48_000;

/** Skills that assume React/Next.js/npm — excluded for html tier */
const HTML_EXCLUDED_SKILLS = new Set([
  'nextjs-architect.md',
  'react-expert.md',
  'shadcn-master.md',
  'tailwind-master.md',
  'component-generator.md',
  'voice-builder.md',
]);

/** Always loaded for html tier builds */
const HTML_CORE_SKILLS = [
  'html-static-builder.md',
  'vocaweb-brain.md',
  'website-designer.md',
  'responsive-design.md',
  'accessibility.md',
  'color-theory.md',
  'typography.md',
  'seo-expert.md',
];

const SKILL_MAP: Record<string, string[]> = {
  chat_planning: [
    'vocaweb-brain.md',
    'prompt-engineering.md',
    'website-designer.md',
  ],
  build_website: [
    'vocaweb-brain.md',
    'website-designer.md',
    'html-static-builder.md',
    'nextjs-architect.md',
    'react-expert.md',
    'ui-ux-expert.md',
    'shadcn-master.md',
    'tailwind-master.md',
    'responsive-design.md',
    'accessibility.md',
    'color-theory.md',
    'typography.md',
    'component-generator.md',
    'design-principles.md',
    'dark-mode.md',
    'seo-expert.md',
    'performance.md',
    'prompt-engineering.md',
    'image-generation.md',
    'mcp-import.md',
  ],
  import_sources: [
    'mcp-import.md',
    'figma-import.md',
    'website-designer.md',
    'nextjs-architect.md',
  ],
  edit_code: [
    'react-expert.md',
    'tailwind-master.md',
    'shadcn-master.md',
    'code-review.md',
    'debugging.md',
    'accessibility.md',
  ],
  change_style: [
    'tailwind-master.md',
    'color-theory.md',
    'typography.md',
    'design-principles.md',
    'glassmorphism.md',
    'dark-mode.md',
    'animation-expert.md',
    'micro-interactions.md',
  ],
  add_section: [
    'website-designer.md',
    'react-expert.md',
    'tailwind-master.md',
    'shadcn-master.md',
    'component-generator.md',
    'bento-grid.md',
    'animation-expert.md',
  ],
  fix_error: [
    'debugging.md',
    'react-expert.md',
    'nextjs-architect.md',
    'code-review.md',
  ],
  ui_improve: [
    'ui-ux-expert.md',
    'design-principles.md',
    'color-theory.md',
    'typography.md',
    'animation-expert.md',
    'micro-interactions.md',
    'glassmorphism.md',
    'responsive-design.md',
    'magicui.md',
  ],
  landing_page: [
    'landing-page-specialist.md',
    'website-designer.md',
    'copywriting.md',
    'seo-expert.md',
    'animation-expert.md',
    'magicui.md',
  ],
  ecommerce: [
    'ecommerce-specialist.md',
    'payments.md',
    'forms.md',
  ],
  saas: [
    'saas-specialist.md',
    'dashboard-specialist.md',
    'authentication.md',
    'forms.md',
    'charts.md',
  ],
  portfolio: [
    'portfolio-specialist.md',
    'animation-expert.md',
  ],
  dashboard: [
    'dashboard-specialist.md',
    'charts.md',
    'charts-best-practices.md',
  ],
};

const KEYWORD_SKILL_MAP: Record<string, string[]> = {
  chat: ['ai-chat-ui.md'],
  ai: ['ai-chat-ui.md', 'ai-design-system.md'],
  crypto: ['crypto-ui.md'],
  web3: ['crypto-ui.md'],
  wallet: ['crypto-ui.md'],
  fintech: ['fintech-ui.md'],
  bank: ['fintech-ui.md'],
  finance: ['fintech-ui.md'],
  health: ['healthcare-ui.md'],
  medical: ['healthcare-ui.md'],
  patient: ['healthcare-ui.md'],
  travel: ['travel-ui.md'],
  booking: ['travel-ui.md'],
  hotel: ['travel-ui.md'],
  education: ['education-ui.md'],
  course: ['education-ui.md'],
  learning: ['education-ui.md'],
  ecommerce: ['ecommerce-specialist.md'],
  shop: ['ecommerce-specialist.md'],
  store: ['ecommerce-specialist.md'],
  cart: ['ecommerce-specialist.md'],
  checkout: ['ecommerce-specialist.md', 'payments.md'],
  payment: ['payments.md'],
  stripe: ['payments.md'],
  dashboard: ['dashboard-specialist.md', 'charts.md'],
  chart: ['charts.md', 'charts-best-practices.md'],
  graph: ['charts.md'],
  portfolio: ['portfolio-specialist.md'],
  saas: ['saas-specialist.md'],
  pricing: ['saas-specialist.md'],
  figma: ['figma-import.md', 'mcp-import.md'],
  notion: ['saas-specialist.md', 'mcp-import.md'],
  canva: ['figma-import.md', 'mcp-import.md'],
  mcp: ['mcp-import.md'],
  landing: ['landing-page-specialist.md', 'copywriting.md'],
  blog: ['seo-expert.md'],
  login: ['authentication.md', 'forms.md'],
  signup: ['authentication.md', 'forms.md'],
  auth: ['authentication.md'],
  form: ['forms.md'],
  animation: ['animation-expert.md', 'micro-interactions.md'],
  motion: ['animation-expert.md'],
  glass: ['glassmorphism.md'],
  bento: ['bento-grid.md'],
  icon: ['iconography.md'],
  svg: ['svg-generator.md'],
  deploy: ['deployment.md'],
  api: ['api-design.md', 'backend-architecture.md'],
  database: ['database-design.md'],
  brand: ['startup-branding.md'],
  'dark mode': ['dark-mode.md'],
  mobile: ['mobile-first.md', 'responsive-design.md'],
};

let skillsDir: string | null = null;
const skillCache = new Map<string, Skill>();

export function setSkillsDir(dir: string): void {
  skillsDir = dir;
  skillCache.clear();
}

function getSkillsDir(): string {
  if (skillsDir) return skillsDir;
  const rootDir = join(process.cwd(), 'skills');
  return rootDir;
}

function loadSkillFile(filename: string, score: number): Skill | null {
  const cacheKey = `${filename}:${score}`;
  if (skillCache.has(cacheKey)) return skillCache.get(cacheKey)!;
  try {
    const filePath = join(getSkillsDir(), filename);
    const content = readFileSync(filePath, 'utf-8');
    const name = filename.replace('.md', '');
    const skill: Skill = { name, filename, content, score };
    skillCache.set(cacheKey, skill);
    return skill;
  } catch {
    return null;
  }
}

function keywordMatches(promptLower: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(promptLower);
}

function scoreSkill(filename: string, intent: string, promptLower: string): number {
  let score = 0;
  const intentSkills = SKILL_MAP[intent] ?? [];
  const intentIndex = intentSkills.indexOf(filename);
  if (intentIndex >= 0) {
    score += 100 - intentIndex;
  }

  for (const [keyword, skills] of Object.entries(KEYWORD_SKILL_MAP)) {
    if (skills.includes(filename) && keywordMatches(promptLower, keyword)) {
      score += 20;
    }
  }

  return score;
}

function filterFilenamesForFramework(
  filenames: Set<string>,
  framework?: BuildFramework,
): Set<string> {
  if (framework !== 'html') return filenames;

  const filtered = new Set<string>();
  for (const f of filenames) {
    if (!HTML_EXCLUDED_SKILLS.has(f)) filtered.add(f);
  }
  for (const f of HTML_CORE_SKILLS) {
    filtered.add(f);
  }
  return filtered;
}

export function getSkillsForIntent(
  intent: string,
  userPrompt: string,
  channel?: 'chat' | 'voice',
  framework?: BuildFramework,
): Skill[] {
  const promptLower = userPrompt.toLowerCase();
  const filenames = new Set<string>();

  const intentSkills = SKILL_MAP[intent];
  if (intentSkills) {
    intentSkills.forEach((f) => filenames.add(f));
  }

  if (channel === 'voice' && framework !== 'html') {
    filenames.add('voice-builder.md');
  }

  for (const [keyword, skills] of Object.entries(KEYWORD_SKILL_MAP)) {
    if (keywordMatches(promptLower, keyword)) {
      skills.forEach((f) => filenames.add(f));
    }
  }

  const filtered = filterFilenamesForFramework(filenames, framework);

  const scored: Skill[] = [];
  for (const filename of filtered) {
    const score = scoreSkill(filename, intent, promptLower);
    const skill = loadSkillFile(filename, score);
    if (skill) scored.push(skill);
  }

  scored.sort((a, b) => b.score - a.score);

  const selected: Skill[] = [];
  let totalChars = 0;
  for (const skill of scored) {
    if (totalChars + skill.content.length > MAX_SKILLS_CHARS) continue;
    selected.push(skill);
    totalChars += skill.content.length;
  }

  return selected;
}

export function getChatSkills(filenames?: string[], framework?: BuildFramework): Skill[] {
  const defaultFiles =
    framework === 'html'
      ? ['vocaweb-brain.md', 'html-static-builder.md', 'website-designer.md']
      : ['vocaweb-brain.md', 'prompt-engineering.md', 'website-designer.md'];
  const targets = filenames ?? defaultFiles;
  const skills: Skill[] = [];
  for (const filename of targets) {
    const skill = loadSkillFile(filename, 100);
    if (skill) skills.push(skill);
  }
  return skills;
}

export function formatSkillsAsContext(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const sections = skills.map((s) =>
    `<skill name="${s.name}">\n${s.content}\n</skill>`,
  );

  return `\n\n<skills_context>
You have access to the following expert skill guides. Follow their principles, checklists, and avoid their listed pitfalls when generating code:

${sections.join('\n\n')}
</skills_context>`;
}

export function getAllSkillFilenames(): string[] {
  try {
    return readdirSync(getSkillsDir()).filter((f) => f.endsWith('.md') && f !== '00-INDEX.md');
  } catch {
    return [];
  }
}
