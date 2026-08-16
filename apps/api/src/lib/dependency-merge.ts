import { readProjectFile, writeProjectFile, listProjectFiles } from './project-manager.js';

const KNOWN_VERSIONS: Record<string, string> = {
  react: '^19.1.0',
  'react-dom': '^19.1.0',
  vite: '^6.3.0',
  '@vitejs/plugin-react': '^4.4.0',
  tailwindcss: '^4.1.0',
  '@tailwindcss/vite': '^4.1.0',
  'react-router-dom': '^7.6.0',
  'framer-motion': '11.18.2',
  'lucide-react': '^0.470.0',
  clsx: '^2.1.0',
  'class-variance-authority': '^0.7.0',
  'tailwind-merge': '^3.0.0',
  '@radix-ui/react-slot': '^1.1.0',
  '@radix-ui/react-dialog': '^1.1.0',
  '@radix-ui/react-dropdown-menu': '^2.1.0',
  '@radix-ui/react-tabs': '^1.1.0',
  '@radix-ui/react-tooltip': '^1.1.0',
  '@radix-ui/react-popover': '^1.1.0',
  '@radix-ui/react-accordion': '^1.2.0',
  '@radix-ui/react-switch': '^1.1.0',
  '@radix-ui/react-label': '^2.1.0',
  'react-icons': '^5.4.0',
  'react-hook-form': '^7.54.0',
  zod: '^3.24.0',
  '@hookform/resolvers': '^4.1.0',
  'date-fns': '^4.1.0',
  embla_carousel_react: '^8.0.0',
  'next-themes': '^0.4.0',
  sonner: '^2.0.0',
  recharts: '^2.15.0',
  'react-day-picker': '^9.0.0',
  '@tanstack/react-table': '^8.21.0',
  'input-otp': '^1.4.0',
  vaul: '^1.0.0',
  cmdk: '^1.0.0',
  'react-resizable-panels': '^2.1.0',
};

const BUILTIN_MODULES = new Set([
  'react', 'react-dom', 'react/jsx-runtime',
  'node:fs', 'node:path', 'node:crypto', 'node:util', 'node:stream',
  'fs', 'path', 'crypto', 'util', 'stream', 'buffer', 'os',
]);

const FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /\bimport\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const SCOPED_RE = /^(@[^/]+\/[^/]+)/;
const BARE_RE = /^([^/]+)/;

function isRelativeOrAliasImport(specifier: string): boolean {
  if (!specifier) return true;
  const first = specifier[0];
  return first === '.' || first === '/' || first === '~' || first === '#';
}

function extractPackageName(specifier: string): string | null {
  if (isRelativeOrAliasImport(specifier)) return null;
  if (specifier.startsWith('@')) {
    const m = SCOPED_RE.exec(specifier);
    return m ? m[1] : null;
  }
  const m = BARE_RE.exec(specifier);
  return m ? m[1] : null;
}

function collectImports(content: string, out: Set<string>): void {
  for (const re of [FROM_RE, SIDE_EFFECT_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const pkgName = extractPackageName(match[1]);
      if (pkgName) out.add(pkgName);
    }
  }
}

export function mergeProjectDependencies(projectId: string, dependencies: string[]): void {
  if (!dependencies.length) return;

  const pkgPath = 'package.json';
  const existing = readProjectFile(projectId, pkgPath);
  if (!existing) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(existing) as Record<string, unknown>;
  } catch {
    return;
  }

  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  for (const entry of dependencies) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex > 0) {
      const name = trimmed.slice(0, atIndex);
      const version = trimmed.slice(atIndex + 1);
      deps[name] = version || KNOWN_VERSIONS[name] || 'latest';
    } else {
      deps[trimmed] = deps[trimmed] ?? KNOWN_VERSIONS[trimmed] ?? 'latest';
    }
  }

  pkg.dependencies = deps;
  writeProjectFile(projectId, pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

export function scanAndMergeMissingDeps(projectId: string): void {
  const pkgRaw = readProjectFile(projectId, 'package.json');
  if (!pkgRaw) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
  } catch {
    return;
  }

  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string> | undefined) ?? {};
  const allDeclared = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

  const imported = new Set<string>();

  for (const filePath of listProjectFiles(projectId)) {
    if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(filePath)) continue;
    const content = readProjectFile(projectId, filePath);
    if (!content) continue;
    collectImports(content, imported);
  }

  let changed = false;
  for (const pkgName of imported) {
    if (BUILTIN_MODULES.has(pkgName)) continue;
    if (!allDeclared.has(pkgName)) {
      deps[pkgName] = KNOWN_VERSIONS[pkgName] ?? 'latest';
      changed = true;
    }
  }

  if (changed) {
    pkg.dependencies = deps;
    writeProjectFile(projectId, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }
}
