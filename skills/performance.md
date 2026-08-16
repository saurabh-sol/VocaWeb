# Performance

**Purpose:** Optimize load time and runtime performance (Core Web Vitals).

**When to use:** Before launch, and any time a page feels slow or Lighthouse flags issues.

## Core Principles

- Optimize LCP (Largest Contentful Paint): compress/lazy-load images below the fold, preload the hero image if above the fold.
- Optimize CLS (Cumulative Layout Shift): always reserve space (width/height or aspect-ratio) for images/embeds.
- Optimize INP/interactivity: avoid large JS bundles blocking the main thread; code-split non-critical components.
- Use `next/image` and `next/font` (or equivalents) for automatic image/font optimization.
- Audit with Lighthouse/PageSpeed Insights and fix the top 2-3 flagged issues before chasing minor ones.
- Avoid render-blocking third-party scripts; load analytics/chat widgets with `defer`/`async` or after interaction.

## Reference Sources

- web.dev — https://web.dev/
- PageSpeed Insights — https://pagespeed.web.dev/
- Lighthouse — https://developer.chrome.com/docs/lighthouse/

## Checklist

- [ ] No layout shift from unsized images/embeds
- [ ] Hero image optimized/preloaded, below-fold images lazy-loaded
- [ ] Third-party scripts deferred
- [ ] Lighthouse score checked before launch

## Common Pitfalls

- Unsized images causing layout shift
- Render-blocking third-party scripts (chat widgets, analytics) in the head
- Shipping a large unsplit JS bundle for a simple page
