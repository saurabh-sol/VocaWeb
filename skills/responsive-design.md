# Responsive Design

**Purpose:** Ensure layouts adapt cleanly across mobile, tablet, and desktop.

**When to use:** On every layout/page build.

## Core Principles

- Design and build mobile-first; add complexity at larger breakpoints, not the reverse.
- Use fluid units (%, rem, fr, minmax()) over fixed pixel widths for containers.
- Use CSS Grid/Flexbox `auto-fit`/`auto-fill` with `minmax()` for card grids that reflow naturally.
- Test at common breakpoints: 375px, 768px, 1024px, 1440px minimum.
- Avoid horizontal scrollbars — check for fixed-width elements or unconstrained content (images, tables, code blocks).
- Typography should scale (clamp() or breakpoint steps) rather than staying static across all screen sizes.

## Reference Sources

- Tailwind Responsive Docs — https://tailwindcss.com/docs
- MDN Responsive Design — https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design

## Checklist

- [ ] Mobile layout built and checked first
- [ ] No fixed-width elements causing horizontal scroll
- [ ] Grid/flex reflow tested at 375/768/1024/1440px
- [ ] Typography scales across breakpoints

## Common Pitfalls

- Desktop-only layout that breaks on mobile
- Fixed pixel widths on containers/images
- Unwrapped tables/code blocks causing overflow
