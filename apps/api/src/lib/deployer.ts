import { createHash } from 'node:crypto';

export interface DeployResult {
  url: string;
  deploymentId: string;
  platform: string;
  status: 'queued' | 'building' | 'ready' | 'error';
  customDomainUrl?: string;
  persistentDomain?: string;
  vercelProjectName: string;
}

export interface DomainInfo {
  name: string;
  apexName: string;
  verified: boolean;
  createdAt: number;
}

export function getVercelToken(): string {
  const token =
    process.env.VERCEL_TOKEN ??
    process.env.VERCEL_DEPLOYMENT_TOKEN ??
    process.env.vercel_deployement_secret ??
    process.env.VERCEL_DEPLOYEMENT_SECRET;

  if (!token?.trim()) {
    throw new Error(
      'Vercel token not set — add VERCEL_TOKEN (or vercel_deployement_secret) to .env',
    );
  }
  return token.trim();
}

function getVercelHeaders() {
  return {
    Authorization: `Bearer ${getVercelToken()}`,
  };
}

function sha1(content: string): string {
  return createHash('sha1').update(content).digest('hex');
}

export function getVercelProjectName(projectId: string): string {
  return `theo-${projectId.replace(/-/g, '').slice(0, 12)}`;
}

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export function toDeployHttpsUrl(hostOrUrl: string): string {
  const host = stripProtocol(hostOrUrl);
  return host ? `https://${host}` : '';
}

export function getPrimaryVercelHost(projectId: string): string {
  return `${getVercelProjectName(projectId)}.vercel.app`;
}

export function resolvePublicDeployUrl(projectId: string): string {
  return toDeployHttpsUrl(getPrimaryVercelHost(projectId));
}

/** Long hashed URLs like *-team-projects.vercel.app are per-deployment, not the public project link. */
export function isVercelDeploymentPreviewUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.vercel.app') && host.includes('-projects');
  } catch {
    return false;
  }
}

export function resolveStableVercelUrl(projectId: string, candidate?: string | null): string {
  const stable = resolvePublicDeployUrl(projectId);
  if (!candidate?.trim()) return stable;
  const normalized = toDeployHttpsUrl(candidate);
  return isVercelDeploymentPreviewUrl(normalized) ? stable : normalized;
}

/** Vercel production installs skip devDependencies — keep the Vite toolchain in dependencies. */
const VITE_BUILD_DEPS: Record<string, string> = {
  vite: '^6.3.0',
  '@vitejs/plugin-react': '^4.4.0',
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: string;
  scripts?: Record<string, string>;
};

function ensureViteBuildTooling(pkg: PackageJsonShape): void {
  const deps = (pkg.dependencies ??= {});
  const devDeps = { ...(pkg.devDependencies ?? {}) };

  for (const [name, fallbackVersion] of Object.entries(VITE_BUILD_DEPS)) {
    if (!deps[name]) {
      deps[name] = devDeps[name] ?? fallbackVersion;
    }
    delete devDeps[name];
  }

  const usesTailwind =
    Boolean(deps.tailwindcss || devDeps.tailwindcss || deps['@tailwindcss/vite'] || devDeps['@tailwindcss/vite']);
  if (usesTailwind) {
    if (!deps['@tailwindcss/vite']) {
      deps['@tailwindcss/vite'] = devDeps['@tailwindcss/vite'] ?? '^4.1.0';
    }
    delete devDeps['@tailwindcss/vite'];
  }

  pkg.devDependencies = Object.keys(devDeps).length > 0 ? devDeps : undefined;

  const scripts = (pkg.scripts ??= {});
  if (!scripts.build) scripts.build = 'vite build';
  if (!scripts.dev) scripts.dev = 'vite --host';
  if (!scripts.preview) scripts.preview = 'vite preview';
}

function patchPackageJson(packageJson: string): string {
  try {
    const pkg = JSON.parse(packageJson) as PackageJsonShape;

    delete pkg.dependencies?.next;

    const scripts = (pkg.scripts ??= {});
    if (scripts.dev?.includes('next')) {
      scripts.dev = 'vite --host';
      scripts.build = 'vite build';
      scripts.preview = 'vite preview';
      delete scripts.start;
      pkg.type = 'module';
    }

    ensureViteBuildTooling(pkg);

    return JSON.stringify(pkg, null, 2);
  } catch {
    return packageJson;
  }
}

function isStaticHtmlProject(files: Record<string, string>): boolean {
  if (!files['index.html']) return false;
  const pkg = files['package.json'];
  if (!pkg) return true;
  try {
    const parsed = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    return !deps.vite && !deps.next;
  } catch {
    return true;
  }
}

function ensureStaticHtmlDeploy(files: Record<string, string>): Record<string, string> {
  const result = { ...files };
  if (!result['vercel.json']) {
    result['vercel.json'] = JSON.stringify(
      {
        version: 2,
        cleanUrls: true,
        trailingSlash: false,
      },
      null,
      2,
    );
  }
  return result;
}

function ensureDeployableFiles(files: Record<string, string>): Record<string, string> {
  const result = { ...files };

  if (!result['package.json']) {
    result['package.json'] = JSON.stringify(
      {
        name: 'theo-site',
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
          vite: '^6.3.0',
          '@vitejs/plugin-react': '^4.4.0',
          tailwindcss: '^4.1.0',
          '@tailwindcss/vite': '^4.1.0',
        },
        devDependencies: {
          typescript: '^5.8.0',
          '@types/react': '^19.1.0',
          '@types/react-dom': '^19.1.0',
        },
      },
      null,
      2,
    );
  } else {
    result['package.json'] = patchPackageJson(result['package.json']);
  }

  if (!result['vite.config.ts']) {
    result['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;
  }

  if (!result['tsconfig.node.json']) {
    result['tsconfig.node.json'] = JSON.stringify({
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
    }, null, 2);
  }

  if (!result['tsconfig.json']) {
    result['tsconfig.json'] = JSON.stringify({
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
    }, null, 2);
  }

  if (!result['index.html']) {
    result['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  }

  if (!result['src/main.tsx']) {
    result['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
`;
  }

  if (!result['src/index.css']) {
    const globalsCss = result['src/globals.css'] ?? result['src/app/globals.css'];
    result['src/index.css'] = globalsCss ?? '@import "tailwindcss";\n';
  }

  const css = result['src/index.css'];
  if (css.includes('@tailwind base')) {
    result['src/index.css'] = css
      .replace(/@tailwind base;\s*/g, '')
      .replace(/@tailwind components;\s*/g, '')
      .replace(/@tailwind utilities;\s*/g, '@import "tailwindcss";\n');
  }

  if (!result['vercel.json']) {
    result['vercel.json'] = JSON.stringify({ framework: 'vite' }, null, 2);
  }

  return result;
}

async function uploadFileToVercel(
  path: string,
  content: string,
): Promise<{ file: string; sha: string; size: number }> {
  const digest = sha1(content);
  const size = Buffer.byteLength(content, 'utf8');

  const response = await fetch('https://api.vercel.com/v2/files', {
    method: 'POST',
    headers: {
      ...getVercelHeaders(),
      'Content-Type': 'application/octet-stream',
      'x-vercel-digest': digest,
      'Content-Length': String(size),
    },
    body: content,
  });

  // 200 = uploaded; file may already exist (deduplicated by SHA)
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload ${path}: ${response.status} ${error}`);
  }

  return { file: path, sha: digest, size };
}

async function uploadAllFiles(
  files: Record<string, string>,
): Promise<Array<{ file: string; sha: string; size: number }>> {
  const entries = Object.entries(files);
  const batchSize = 10;
  const uploaded: Array<{ file: string; sha: string; size: number }> = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(([path, content]) => uploadFileToVercel(path, content)),
    );
    uploaded.push(...results);
  }

  return uploaded;
}

async function disableDeploymentProtection(projectName: string): Promise<void> {
  try {
    await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      method: 'PATCH',
      headers: {
        ...getVercelHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        publicSource: true,
        ssoProtection: null,
        passwordProtection: null,
        framework: 'vite',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        outputDirectory: 'dist',
      }),
    });
  } catch {
    // best-effort — don't block deploy if this fails
  }
}

export async function ensureVercelProject(projectName: string): Promise<string> {
  const headers = {
    ...getVercelHeaders(),
    'Content-Type': 'application/json',
  };

  const check = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
    headers: getVercelHeaders(),
  });

  if (check.ok) {
    const data = (await check.json()) as { id: string };
    await disableDeploymentProtection(projectName);
    return data.id;
  }

  const create = await fetch('https://api.vercel.com/v11/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: projectName,
      framework: 'vite',
      publicSource: true,
    }),
  });

  if (!create.ok) {
    const error = await create.text();
    throw new Error(`Failed to create Vercel project: ${create.status}: ${error}`);
  }

  const data = (await create.json()) as { id: string };
  await disableDeploymentProtection(projectName);
  return data.id;
}

export async function deployToVercel(
  projectId: string,
  files: Record<string, string>,
  options?: { persistentDomain?: string },
): Promise<DeployResult> {
  const projectName = getVercelProjectName(projectId);
  await ensureVercelProject(projectName);

  const staticHtml = isStaticHtmlProject(files);
  const deployableFiles = staticHtml ? ensureStaticHtmlDeploy(files) : ensureDeployableFiles(files);
  const uploadedFiles = await uploadAllFiles(deployableFiles);

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      ...getVercelHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      project: projectName,
      files: uploadedFiles,
      projectSettings: staticHtml
        ? {
            framework: null,
            buildCommand: null,
            installCommand: null,
            outputDirectory: null,
          }
        : {
            framework: 'vite',
            buildCommand: 'npm run build',
            installCommand: 'npm install',
            outputDirectory: 'dist',
          },
      target: 'production',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel deployment error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    id: string;
    url: string;
    readyState: string;
  };

  const statusMap: Record<string, DeployResult['status']> = {
    QUEUED: 'queued',
    INITIALIZING: 'building',
    BUILDING: 'building',
    READY: 'ready',
    ERROR: 'error',
    CANCELED: 'error',
  };

  let customDomainUrl: string | undefined;
  const persistentDomain = options?.persistentDomain;
  const vercelUrl = resolvePublicDeployUrl(projectId);

  if (persistentDomain) {
    try {
      const domainResult = await setCustomDomain(projectId, persistentDomain, projectName);
      customDomainUrl = toDeployHttpsUrl(domainResult.domain);
    } catch (err) {
      console.warn('[deploy] Custom domain attach skipped:', err);
    }
  }

  return {
    url: vercelUrl,
    deploymentId: data.id,
    platform: 'vercel',
    status: statusMap[data.readyState] ?? 'building',
    customDomainUrl,
    persistentDomain,
    vercelProjectName: projectName,
  };
}

export async function checkDeploymentStatus(
  deploymentId: string,
  projectId: string,
): Promise<DeployResult> {
  const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
    headers: getVercelHeaders(),
  });

  if (!response.ok) throw new Error(`Failed to check deployment: ${response.status}`);

  const data = (await response.json()) as {
    id: string;
    url: string;
    readyState: string;
    name: string;
  };

  const statusMap: Record<string, DeployResult['status']> = {
    QUEUED: 'queued',
    INITIALIZING: 'building',
    BUILDING: 'building',
    READY: 'ready',
    ERROR: 'error',
    CANCELED: 'error',
  };

  const projectName = getVercelProjectName(projectId);

  return {
    url: resolvePublicDeployUrl(projectId),
    deploymentId: data.id,
    platform: 'vercel',
    status: statusMap[data.readyState] ?? 'building',
    vercelProjectName: projectName,
  };
}

export async function setCustomDomain(
  projectId: string,
  domain: string,
  projectName?: string,
): Promise<{ domain: string; verified: boolean }> {
  const name = projectName ?? getVercelProjectName(projectId);

  const response = await fetch(`https://api.vercel.com/v10/projects/${name}/domains`, {
    method: 'POST',
    headers: {
      ...getVercelHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set custom domain: ${response.status}: ${error}`);
  }

  const data = (await response.json()) as { name: string; verified: boolean };
  return { domain: data.name, verified: data.verified };
}

export async function getDeploymentDomains(projectId: string): Promise<DomainInfo[]> {
  const projectName = getVercelProjectName(projectId);

  const response = await fetch(`https://api.vercel.com/v9/projects/${projectName}/domains`, {
    headers: getVercelHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get domains: ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    domains: Array<{
      name: string;
      apexName: string;
      verified: boolean;
      createdAt: number;
    }>;
  };

  return data.domains.map((d) => ({
    name: d.name,
    apexName: d.apexName,
    verified: d.verified,
    createdAt: d.createdAt,
  }));
}
