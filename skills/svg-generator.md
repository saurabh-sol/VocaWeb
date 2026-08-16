# SVG Generator

**Purpose:** Create clean, scalable vector graphics (icons, illustrations, simple diagrams) as inline SVG.

**When to use:** When a lightweight custom graphic is needed instead of a raster image.

## Core Principles

- Use a `viewBox` and avoid fixed width/height in the SVG itself so it scales via CSS.
- Keep path data as simple as possible; simplify curves rather than shipping huge point-dense paths.
- Use `currentColor` for strokes/fills on icons so they inherit text color and support theming.
- Group related shapes with `<g>` and meaningful structure for maintainability.
- Add `role="img"` and a `<title>` (or aria-hidden if purely decorative) for accessibility.

## Reference Sources

- MDN SVG docs — https://developer.mozilla.org/en-US/docs/Web/SVG

## Checklist

- [ ] viewBox used instead of fixed pixel dimensions
- [ ] currentColor used for themeable icons
- [ ] Accessibility attributes set appropriately

## Common Pitfalls

- Fixed-size SVGs that don't scale responsively
- Hardcoded fill colors that break in dark mode
