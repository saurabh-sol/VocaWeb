# Color Theory

**Purpose:** Build accessible, purposeful color palettes.

**When to use:** When defining a brand palette or choosing colors for UI states.

## Core Principles

- Start from one primary brand color, derive a small neutral scale (grays), and 3-4 semantic colors (success/warning/error/info).
- Check all text/background pairs against WCAG AA contrast before finalizing.
- Use color purposefully: don't introduce a new hue without a specific semantic meaning.
- Prefer HSL when generating tints/shades programmatically — easier to keep hue consistent while varying lightness.
- Design dark mode as inverted lightness with adjusted saturation, not a literal color invert.

## Reference Sources

- Refactoring UI color chapter — https://www.refactoringui.com/

## Checklist

- [ ] Contrast checked for all text/background pairs
- [ ] Semantic colors (success/error/warning) defined and used consistently
- [ ] Dark mode palette intentionally tuned, not auto-inverted

## Common Pitfalls

- Introducing arbitrary new colors without semantic purpose
- Failing contrast on primary text/background combos
