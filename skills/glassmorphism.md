# Glassmorphism

**Purpose:** Apply frosted-glass visual style tastefully.

**When to use:** When a modern translucent-panel aesthetic is requested.

## Core Principles

- Use `backdrop-blur` with a semi-transparent background (e.g. `bg-white/10`) over a rich background image/gradient.
- Pair with a subtle 1px border (often `border-white/20`) to define the panel edge.
- Ensure text contrast still passes on top of the blurred panel — test against the busiest part of the background.
- Use sparingly — glass panels work best for a few featured cards/navbars, not the entire page.
- Provide a solid-background fallback for browsers/contexts without backdrop-filter support.

## Reference Sources

- CSS backdrop-filter — MDN https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter

## Checklist

- [ ] Contrast verified over the busiest background area
- [ ] Used selectively, not on every surface
- [ ] Solid fallback exists for unsupported browsers

## Common Pitfalls

- Overusing glass panels until the whole UI feels foggy/low-contrast
- Text unreadable over a busy blurred background
