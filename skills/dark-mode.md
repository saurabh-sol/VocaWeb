# Dark Mode

**Purpose:** Implement dark mode correctly and consistently.

**When to use:** Whenever a project needs a light/dark theme toggle.

## Core Principles

- Define light and dark token sets together from the start, not as a retrofit.
- Use `class` or `data-attribute` based dark mode (Tailwind `dark:`) rather than pure `prefers-color-scheme` only, so users can override.
- Don't just invert lightness — reduce saturation slightly and avoid pure black backgrounds (#000) for comfort.
- Test contrast ratios independently in dark mode; a pair that passes in light mode may fail in dark.
- Persist the user's theme choice (respecting system default first) across sessions.

## Reference Sources

- Tailwind dark mode docs — https://tailwindcss.com/docs/dark-mode

## Checklist

- [ ] Light/dark tokens designed together
- [ ] User can override system preference and it persists
- [ ] Contrast re-checked specifically in dark mode

## Common Pitfalls

- Dark mode as a naive CSS invert filter
- Pure black backgrounds with pure white text (harsh contrast)
