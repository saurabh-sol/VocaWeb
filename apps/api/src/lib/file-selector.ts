const COMPONENT_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const STYLE_EXTENSIONS = ['.css', '.scss'];
const CONFIG_FILES = ['vite.config.ts', 'tsconfig.json', 'package.json'];

const ALWAYS_INCLUDE_PATHS = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
];

export function selectRelevantFiles(
  allFiles: Record<string, string>,
  instruction: string,
  maxFiles = 10,
  maxTotalSize = 50_000,
): Record<string, string> {
  const lower = instruction.toLowerCase();
  const scored: { path: string; score: number }[] = [];

  for (const path of Object.keys(allFiles)) {
    let score = 0;
    const fileName = path.split('/').pop() ?? '';
    const fileNameLower = fileName.toLowerCase();

    if (lower.includes(fileNameLower.replace(/\.\w+$/, ''))) score += 10;

    if (lower.includes('nav') && fileNameLower.includes('nav')) score += 8;
    if (lower.includes('header') && fileNameLower.includes('header')) score += 8;
    if (lower.includes('footer') && fileNameLower.includes('footer')) score += 8;
    if (lower.includes('hero') && fileNameLower.includes('hero')) score += 8;
    if (lower.includes('pricing') && fileNameLower.includes('pricing')) score += 8;

    if (lower.includes('style') || lower.includes('color') || lower.includes('dark') || lower.includes('theme')) {
      if (STYLE_EXTENSIONS.some((ext) => path.endsWith(ext))) score += 6;
      if (path.includes('tailwind')) score += 8;
      if (path.includes('globals')) score += 5;
    }

    if (path === 'src/App.tsx' || path === 'src/main.tsx') score += 3;
    if (path === 'package.json') score += 1;

    if (CONFIG_FILES.includes(fileName)) score += 2;
    if (COMPONENT_EXTENSIONS.some((ext) => path.endsWith(ext))) score += 1;

    scored.push({ path, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const result: Record<string, string> = {};
  let totalSize = 0;
  let count = 0;

  for (const { path } of scored) {
    if (count >= maxFiles) break;
    const content = allFiles[path];
    if (totalSize + content.length > maxTotalSize) continue;
    result[path] = content;
    totalSize += content.length;
    count++;
  }

  return result;
}

export function selectRelevantFilesForEdit(
  allFiles: Record<string, string>,
  instruction: string,
  maxFiles = 10,
  maxTotalSize = 50_000,
): Record<string, string> {
  const selected = selectRelevantFiles(allFiles, instruction, maxFiles, maxTotalSize);

  for (const path of ALWAYS_INCLUDE_PATHS) {
    if (allFiles[path]) {
      selected[path] = allFiles[path];
    }
  }

  return selected;
}
