import type { ImportBundleSection } from '@theo/shared';

export function parseMarkdownToSections(markdown: string): ImportBundleSection[] {
  const lines = markdown.split('\n');
  const sections: ImportBundleSection[] = [];
  let current: ImportBundleSection | null = null;
  let bodyLines: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!current) return;
    current.body = bodyLines.join('\n').trim();
    if (bullets.length) current.bullets = [...bullets];
    sections.push(current);
    current = null;
    bodyLines = [];
    bullets = [];
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      const title = heading[2].trim();
      current = {
        id: `section-${sections.length}`,
        title,
        level,
        body: '',
      };
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet && current) {
      bullets.push(bullet[1].trim());
      continue;
    }

    if (current) bodyLines.push(line);
  }
  flush();

  if (sections.length === 0 && markdown.trim()) {
    sections.push({
      id: 'section-0',
      title: 'Content',
      level: 1,
      body: markdown.trim(),
    });
  }

  return sections;
}

export function sectionsToPlanText(sections: ImportBundleSection[]): string {
  return sections
    .map((s) => {
      const prefix = '#'.repeat(Math.min(s.level, 6));
      const bullets = s.bullets?.length
        ? '\n' + s.bullets.map((b) => `- ${b}`).join('\n')
        : '';
      return `${prefix} ${s.title}\n${s.body}${bullets}`.trim();
    })
    .join('\n\n');
}
