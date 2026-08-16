import { readProjectFile, writeProjectFile, listProjectFiles } from './project-manager.js';

const CORRECT_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;

/**
 * Post-generation patches for common LLM mistakes:
 * - Ensure vite.config.ts uses @tailwindcss/vite plugin
 * - @tailwind directives → @import "tailwindcss"
 * - Remove any Next.js patterns (layout.tsx, "use client", next.config)
 * - framer-motion v12 → pinned to 11.18.2 (motion-dom compat)
 * - Ensure index.html + src/main.tsx entry point exists
 */
export function patchTailwindV4Config(projectId: string): void {
  patchViteConfig(projectId);
  patchGlobalsCss(projectId);
  ensureViteTailwindDep(projectId);
  removeNextJsPatterns(projectId);
  patchFramerMotionVersion(projectId);
  ensureEntryPoint(projectId);
  ensureTsconfigNode(projectId);
}

function patchViteConfig(projectId: string): void {
  const content = readProjectFile(projectId, 'vite.config.ts');
  if (!content) {
    writeProjectFile(projectId, 'vite.config.ts', CORRECT_VITE_CONFIG);
    return;
  }
  if (!content.includes('@tailwindcss/vite')) {
    writeProjectFile(projectId, 'vite.config.ts', CORRECT_VITE_CONFIG);
  }
}

function patchGlobalsCss(projectId: string): void {
  for (const cssPath of ['src/index.css', 'src/globals.css', 'src/app/globals.css']) {
    const content = readProjectFile(projectId, cssPath);
    if (!content) continue;

    if (content.includes('@tailwind base')) {
      const patched = content
        .replace(/@tailwind base;\s*/g, '')
        .replace(/@tailwind components;\s*/g, '')
        .replace(/@tailwind utilities;\s*/g, '@import "tailwindcss";\n');
      writeProjectFile(projectId, cssPath, patched);
    }
  }

  const indexCss = readProjectFile(projectId, 'src/index.css');
  if (!indexCss) {
    const globalsCss = readProjectFile(projectId, 'src/globals.css') ||
                       readProjectFile(projectId, 'src/app/globals.css');
    if (globalsCss) {
      writeProjectFile(projectId, 'src/index.css', globalsCss);
    }
  }
}

function ensureViteTailwindDep(projectId: string): void {
  const raw = readProjectFile(projectId, 'package.json');
  if (!raw) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = { ...((pkg.devDependencies ?? {}) as Record<string, string>) };
  let changed = false;

  for (const [name, version] of [
    ['@tailwindcss/vite', '^4.1.0'],
    ['@vitejs/plugin-react', '^4.4.0'],
    ['vite', '^6.3.0'],
  ] as const) {
    if (!deps[name]) {
      deps[name] = devDeps[name] ?? version;
      changed = true;
    }
    if (devDeps[name]) {
      delete devDeps[name];
      changed = true;
    }
  }

  if (changed) {
    pkg.dependencies = deps;
    pkg.devDependencies = Object.keys(devDeps).length > 0 ? devDeps : undefined;
    writeProjectFile(projectId, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

function removeNextJsPatterns(projectId: string): void {
  const raw = readProjectFile(projectId, 'package.json');
  if (!raw) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  let changed = false;

  if (deps.next) {
    delete deps.next;
    changed = true;
  }
  if (devDeps['@tailwindcss/postcss']) {
    delete devDeps['@tailwindcss/postcss'];
    changed = true;
  }

  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  if (scripts.dev?.includes('next')) {
    scripts.dev = 'vite --host';
    scripts.build = 'vite build';
    scripts.preview = 'vite preview';
    delete scripts.start;
    pkg.type = 'module';
    changed = true;
  }

  if (changed) {
    pkg.dependencies = deps;
    pkg.devDependencies = devDeps;
    pkg.scripts = scripts;
    writeProjectFile(projectId, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  for (const filePath of listProjectFiles(projectId)) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) continue;
    const content = readProjectFile(projectId, filePath);
    if (!content) continue;

    let patched = content;
    patched = patched.replace(/^['"]use client['"];?\s*\n*/m, '');
    patched = patched.replace(/^['"]use server['"];?\s*\n*/m, '');

    if (patched !== content) {
      writeProjectFile(projectId, filePath, patched);
    }
  }
}

const SAFE_FRAMER_VERSION = '11.18.2';

function patchFramerMotionVersion(projectId: string): void {
  const raw = readProjectFile(projectId, 'package.json');
  if (!raw) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  let changed = false;

  for (const section of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps) continue;

    if (deps['framer-motion']) {
      const ver = deps['framer-motion'];
      if (ver !== SAFE_FRAMER_VERSION && !ver.startsWith('11.')) {
        deps['framer-motion'] = SAFE_FRAMER_VERSION;
        changed = true;
      }
    }

    if (deps['motion']) {
      delete deps['motion'];
      if (!deps['framer-motion']) {
        deps['framer-motion'] = SAFE_FRAMER_VERSION;
      }
      changed = true;
    }

    if (deps['motion-dom']) {
      delete deps['motion-dom'];
      changed = true;
    }
  }

  if (changed) {
    writeProjectFile(projectId, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  }

  rewriteMotionImports(projectId);
}

function rewriteMotionImports(projectId: string): void {
  for (const filePath of listProjectFiles(projectId)) {
    if (!/\.(tsx?|jsx?)$/.test(filePath)) continue;
    const content = readProjectFile(projectId, filePath);
    if (!content) continue;

    if (!content.includes('motion/react') && !content.includes("from 'motion'") && !content.includes('from "motion"')) {
      continue;
    }

    let patched = content;
    patched = patched.replace(/from\s+['"]motion\/react['"]/g, "from 'framer-motion'");
    patched = patched.replace(/from\s+['"]motion['"]/g, "from 'framer-motion'");

    if (patched !== content) {
      writeProjectFile(projectId, filePath, patched);
    }
  }
}

const TSCONFIG_NODE_CONTENT = JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2023'],
    module: 'ESNext',
    skipLibCheck: true,
    moduleResolution: 'bundler',
    allowSyntheticDefaultImports: true,
    isolatedModules: true,
    noEmit: true,
  },
  include: ['vite.config.ts'],
}, null, 2) + '\n';

function ensureTsconfigNode(projectId: string): void {
  const existing = readProjectFile(projectId, 'tsconfig.node.json');
  if (existing) return;

  writeProjectFile(projectId, 'tsconfig.node.json', TSCONFIG_NODE_CONTENT);

  const tsconfig = readProjectFile(projectId, 'tsconfig.json');
  if (tsconfig && !tsconfig.includes('tsconfig.node.json')) {
    try {
      const parsed = JSON.parse(tsconfig) as Record<string, unknown>;
      parsed.references = [{ path: './tsconfig.node.json' }];
      writeProjectFile(projectId, 'tsconfig.json', JSON.stringify(parsed, null, 2) + '\n');
    } catch {
      // keep existing tsconfig
    }
  }
}

function ensureEntryPoint(projectId: string): void {
  const html = readProjectFile(projectId, 'index.html');
  if (!html) {
    writeProjectFile(projectId, 'index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body class="min-h-screen bg-zinc-950 text-white antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);
  }

  const main = readProjectFile(projectId, 'src/main.tsx');
  if (!main) {
    writeProjectFile(projectId, 'src/main.tsx', `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`);
  }
}
