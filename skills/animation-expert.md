# Animation Expert

**Purpose:** Implement smooth, performant motion using Framer Motion / Motion and GSAP.

**When to use:** When a request involves transitions, scroll effects, or interactive motion.

## Core Principles

- Prefer Motion (Framer Motion) for React component-level animation (enter/exit, layout, gestures).
- Prefer GSAP for complex timelines, scroll-triggered sequences, and SVG/canvas animation.
- Animate transform and opacity, not layout properties like width/height/top, for 60fps performance.
- Keep durations short (150-400ms for UI, up to 800ms for hero/scroll storytelling) and use easing, not linear.
- Always provide a `prefers-reduced-motion` fallback that disables or simplifies animation.
- Use `AnimatePresence` for exit animations in React instead of manually toggling visibility.

## Reference Sources

- Motion — https://motion.dev/
- GSAP — https://gsap.com/docs/

## Checklist

- [ ] Animations use transform/opacity, not layout-triggering properties
- [ ] Reduced-motion fallback implemented
- [ ] Durations/easing feel natural, not linear or overly long

## Common Pitfalls

- Animating width/height/top causing layout thrash
- Overly long or linear animations that feel sluggish
- No reduced-motion handling
