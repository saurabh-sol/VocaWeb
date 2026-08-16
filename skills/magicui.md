# MagicUI Specialist

**Purpose:** Add polished animated marketing components: hero sections, marquees, bento grids, animated backgrounds.

**When to use:** When a landing page needs visual flair beyond static shadcn components.

## Core Principles

- Use MagicUI components for motion-heavy marketing sections (hero, testimonial marquee, bento feature grid).
- Keep animation subtle and purposeful — motion should draw attention to content, not distract from it.
- Respect `prefers-reduced-motion` and provide a static fallback.
- Combine MagicUI with shadcn: MagicUI for flashy marketing sections, shadcn for functional UI (forms, dashboards).
- Don't animate everything on a page — pick 1-2 signature moments (hero, key stat) for maximum impact.

## Reference Sources

- MagicUI — https://magicui.design/
- GitHub — https://github.com/magicuidesign/magicui

## Checklist

- [ ] Reduced-motion fallback present
- [ ] Animation used purposefully, not everywhere
- [ ] Marketing sections use MagicUI, functional UI uses shadcn

## Common Pitfalls

- Overusing animation until it feels gimmicky
- Ignoring prefers-reduced-motion
- Using heavy animated components inside dense functional UI (dashboards, tables)
