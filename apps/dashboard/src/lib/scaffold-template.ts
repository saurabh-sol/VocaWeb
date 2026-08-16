/** Tier-specific scaffolds shown instantly while AI generates the real site */

export type ScaffoldTier = 'v1' | 'v2' | 'v3';

/** v1 (Base) — Plain HTML/CSS/JS, no framework, instant preview */
export const SCAFFOLD_FILES_V1: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Building...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; }
    .spinner { width: 48px; height: 48px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #f59e0b; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    p { color: #888; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div style="text-align:center">
    <div class="spinner"></div>
    <h1>Vocaweb is building your site</h1>
    <p>Your live preview will appear shortly</p>
  </div>
</body>
</html>`,
};

/** v2 (Pro) — React + Vite + Tailwind 4 */
export const SCAFFOLD_FILES: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'theo-preview-shell',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite --host',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.1.0',
        'react-dom': '^19.1.0',
        'framer-motion': '11.18.2',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.4.0',
        vite: '^6.3.0',
        typescript: '^5.8.0',
        '@types/react': '^19.1.0',
        '@types/react-dom': '^19.1.0',
        tailwindcss: '^4.1.0',
        '@tailwindcss/vite': '^4.1.0',
      },
    },
    null,
    2,
  ),
  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
  'tsconfig.json': JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        resolveJsonModule: true,
        esModuleInterop: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    },
    null,
    2,
  ),
  'tsconfig.node.json': JSON.stringify(
    {
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
    },
    null,
    2,
  ),
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vocaweb — Building...</title>
  </head>
  <body class="min-h-screen bg-zinc-950 text-white antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  'src/index.css': `@import "tailwindcss";
`,
  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  'src/App.tsx': `export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="h-16 w-16 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Vocaweb is building your site</h1>
        <p className="mt-2 text-zinc-400 text-sm">Your live preview will update as sections are ready</p>
      </div>
    </main>
  );
}
`,
};

/** v3 (Max) — Next.js 14 + Tailwind 3 */
export const SCAFFOLD_FILES_V3: Record<string, string> = {
  'package.json': JSON.stringify(
    {
      name: 'theo-preview-shell',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        next: '^14.2.18',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        typescript: '^5.8.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        tailwindcss: '^3.4.17',
        postcss: '^8.4.49',
        autoprefixer: '^10.4.20',
      },
    },
    null,
    2,
  ),
  'next.config.mjs': `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
`,
  'tsconfig.json': JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  ),
  'tailwind.config.ts': `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
`,
  'postcss.config.mjs': `const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
`,
  'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
  'app/layout.tsx': `import './globals.css';

export const metadata = {
  title: 'Vocaweb — Building...',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">{children}</body>
    </html>
  );
}
`,
  'app/page.tsx': `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="h-16 w-16 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Vocaweb is building your site</h1>
        <p className="mt-2 text-zinc-400 text-sm">Your live preview will update as sections are ready</p>
      </div>
    </main>
  );
}
`,
};

export function getScaffoldForTier(tier: ScaffoldTier): Record<string, string> {
  switch (tier) {
    case 'v1':
      return SCAFFOLD_FILES_V1;
    case 'v3':
      return SCAFFOLD_FILES_V3;
    case 'v2':
    default:
      return SCAFFOLD_FILES;
  }
}

/** Returns true if the file set is a plain HTML project (no bundler) */
export function isStaticHtmlProject(files: Record<string, string>): boolean {
  return !files['package.json'] && !!files['index.html'];
}

/** Combine separate CSS/JS files into a single HTML string for static preview */
export function buildStaticPreviewHtml(files: Record<string, string>): string {
  let html = files['index.html'] || '<!DOCTYPE html><html><body><p>No index.html found</p></body></html>';

  const cssFiles = Object.entries(files).filter(([p]) => p.endsWith('.css'));
  for (const [path, content] of cssFiles) {
    html = html.replace('</head>', `<style>/* ${path} */\n${content}\n</style>\n</head>`);
  }

  const jsFiles = Object.entries(files).filter(([p]) => p.endsWith('.js'));
  for (const [path, content] of jsFiles) {
    html = html.replace('</body>', `<script>/* ${path} */\n${content}\n</script>\n</body>`);
  }

  return html;
}

export const SCAFFOLD_KEY = '__theo_scaffold__';
