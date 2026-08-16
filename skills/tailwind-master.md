# Tailwind Master

**Purpose:** Write clean, consistent, responsive Tailwind CSS.

**When to use:** Any time utility classes are written for layout or styling.

## Core Principles

- Use the spacing scale consistently (4, 8, 12, 16, 24, 32...) rather than arbitrary values like `p-[13px]`.
- Mobile-first: base classes = mobile styles, then layer `sm: md: lg: xl:` for larger screens.
- Prefer Flexbox/Grid utilities (`flex`, `grid`, `gap-*`) over manual margins for spacing between siblings.
- Use `dark:` variants for dark mode instead of separate stylesheets or JS-based theme switching of classes.
- Extract repeated utility clusters into a component or use `@apply` sparingly — don't fight Tailwind's utility-first philosophy.
- Use semantic color tokens from the theme config (e.g. `bg-primary`) instead of raw palette values in components.

## Reference Sources

- Tailwind Docs — https://tailwindcss.com/docs

## Checklist

- [ ] Spacing scale consistent, no arbitrary pixel values
- [ ] Mobile-first responsive classes
- [ ] Dark mode handled via dark: variant
- [ ] Gap/flex/grid used instead of manual margins where possible

## Common Pitfalls

- Arbitrary magic-number values scattered everywhere
- Desktop-first responsive overrides
- Duplicated utility clusters that should be a component
