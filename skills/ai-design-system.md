# AI Design System

**Purpose:** Define a coherent design system (tokens, components, rules) the AI agent applies consistently across a whole generated site.

**When to use:** At the start of a new project, before generating individual pages.

## Core Principles

- Define tokens once: color palette (primary/secondary/neutral/semantic), spacing scale, type scale, radius, shadow levels.
- Every generated page/component must pull from these tokens — no ad hoc colors or spacing.
- Document component variants (button primary/secondary/ghost, card default/elevated) so generation stays consistent.
- Version the design system as the project evolves; note breaking changes to tokens.
- Keep light/dark mode token pairs defined together, not bolted on later.

## Reference Sources

- Design tokens studio / general design systems practice

## Checklist

- [ ] Token set defined before first page is built
- [ ] All components/pages reference tokens, not raw values
- [ ] Light/dark variants defined together

## Common Pitfalls

- Drifting colors/spacing per-page instead of using shared tokens
- Dark mode added as an afterthought
