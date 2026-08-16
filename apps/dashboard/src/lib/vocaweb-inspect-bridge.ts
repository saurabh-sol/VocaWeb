/** Injected into preview sites so the parent sandbox can enable click-to-select. */

export interface SelectedElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  selector: string;
}

export const VOCAWEB_INSPECT_FILE = 'public/vocaweb-inspect.js';

export const VOCAWEB_INSPECT_SCRIPT = `
(function () {
  var active = false;
  var highlight = null;

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      var part = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        var cls = el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) part += '.' + cls.map(function (c) { return CSS.escape(c); }).join('.');
      }
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function clearHighlight() {
    if (highlight) {
      highlight.style.outline = '';
      highlight.style.outlineOffset = '';
      highlight = null;
    }
  }

  function onClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    var t = e.target;
    if (!(t instanceof Element)) return;
    clearHighlight();
    t.style.outline = '2px solid #3b82f6';
    t.style.outlineOffset = '2px';
    highlight = t;
    var text = (t.textContent || '').trim().slice(0, 120);
    window.parent.postMessage({
      type: 'vocaweb:element-selected',
      payload: {
        tagName: t.tagName.toLowerCase(),
        id: t.id || undefined,
        className: typeof t.className === 'string' ? t.className : undefined,
        text: text || undefined,
        selector: cssPath(t),
      },
    }, '*');
  }

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.type !== 'vocaweb:set-inspect') return;
    active = !!ev.data.enabled;
    if (!active) clearHighlight();
  });

  document.addEventListener('click', onClick, true);
})();
`.trim();

/** Ensure inspect bridge files are present in the project tree. */
export function withInspectBridge(files: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...files, [VOCAWEB_INSPECT_FILE]: VOCAWEB_INSPECT_SCRIPT };

  if (next['index.html'] && !next['index.html'].includes('vocaweb-inspect.js')) {
    next['index.html'] = next['index.html'].replace(
      '</body>',
      '    <script src="/vocaweb-inspect.js"></script>\n  </body>',
    );
  }

  const layoutKey = Object.keys(next).find(
    (k) => k === 'app/layout.tsx' || k.endsWith('/app/layout.tsx'),
  );
  if (layoutKey && !next[layoutKey].includes('vocaweb-inspect.js')) {
    let layout = next[layoutKey];
    if (layout.includes('</body>')) {
      layout = layout.replace(
        '</body>',
        '        <script src="/vocaweb-inspect.js"></script>\n      </body>',
      );
    } else if (layout.includes('{children}')) {
      layout = layout.replace(
        '{children}',
        `{children}\n        <script src="/vocaweb-inspect.js"></script>`,
      );
    }
    next[layoutKey] = layout;
  }

  return next;
}
