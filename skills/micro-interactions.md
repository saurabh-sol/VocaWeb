# Micro-interactions

**Purpose:** Add small feedback animations that make an interface feel responsive.

**When to use:** On buttons, toggles, form fields, and other interactive elements.

## Core Principles

- Every clickable element should have a hover and active/pressed state, even if subtle (scale, shadow, color shift).
- Keep micro-interaction durations very short (100-200ms) so they feel instant, not sluggish.
- Use micro-interactions to confirm success (checkmark animation, subtle bounce) rather than relying on text alone.
- Don't animate on every re-render — trigger only on genuine user interaction/state change.
- Respect prefers-reduced-motion by disabling non-essential micro-interactions.

## Reference Sources

- Motion/Framer Motion docs — https://motion.dev/

## Checklist

- [ ] Hover/active states present on all interactive elements
- [ ] Durations short and snappy
- [ ] Reduced-motion respected

## Common Pitfalls

- Missing hover/focus feedback on interactive elements
- Micro-interactions long enough to feel laggy
