const previewUrls = new Map<string, string>();

export function generatePreviewHtml(files: Record<string, string>): string {
  const pageFile =
    files['src/App.tsx'] ?? files['index.html'];
  const cssFile =
    files['src/index.css'] ?? files['src/globals.css'] ?? '';

  if (!pageFile && !files['index.html']) {
    const fileList = Object.keys(files)
      .map((f) => `<li><code>${f}</code></li>`)
      .join('\n');
    return `<!DOCTYPE html>
<html><head><title>Project Preview</title>
<style>body{background:#09090b;color:#fafafa;font-family:system-ui;padding:2rem}code{color:#a78bfa}</style>
</head><body>
<h1>Project Generated</h1>
<p>Files created:</p>
<ul>${fileList}</ul>
</body></html>`;
  }

  if (files['index.html']) return files['index.html'];

  const fileList = Object.keys(files)
    .map(
      (f) =>
        `<li><code>${f}</code> <span style="color:#71717a">(${files[f].length} bytes)</span></li>`,
    )
    .join('\n');
  return `<!DOCTYPE html>
<html><head><title>Project Preview</title>
<style>
  body { background:#09090b; color:#fafafa; font-family:system-ui; padding:2rem; max-width:800px; margin:0 auto; }
  code { color:#a78bfa; }
  h1 { background:linear-gradient(135deg,#7c3aed,#6d28d9); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  ul { list-style:none; padding:0; }
  li { padding:0.5rem 0; border-bottom:1px solid #27272a; }
  .badge { background:#6d28d9; color:white; padding:0.25rem 0.75rem; border-radius:9999px; font-size:0.75rem; }
</style>
</head><body>
<h1>Project Ready</h1>
<span class="badge">React + Vite + TypeScript + Tailwind</span>
<p style="color:#a1a1aa">Full preview requires Docker sandbox (Phase 7 production). Below are the generated files:</p>
<ul>${fileList}</ul>
${cssFile ? `<style>${cssFile}</style>` : ''}
</body></html>`;
}

export function setPreviewUrl(projectId: string, url: string): void {
  previewUrls.set(projectId, url);
}

export function getPreviewUrl(projectId: string): string | null {
  return previewUrls.get(projectId) ?? null;
}
