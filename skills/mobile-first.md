# Mobile-First

**Purpose:** Default design/build approach starting from the smallest viewport.

**When to use:** On every layout — this is a baseline default, not an optional skill.

## Core Principles

- Always build the mobile layout first, then progressively enhance for tablet/desktop breakpoints.
- Design touch-first: minimum 44px touch targets, adequate spacing between tappable elements.
- Avoid hover-dependent interactions as the only way to reveal important content on mobile.
- Collapse complex navigation into a mobile pattern (hamburger/bottom nav) that's still fully accessible.
- Test critical flows (signup, checkout, primary CTA) on a real mobile viewport width before considering a page done.

## Reference Sources

- Tailwind responsive docs, MDN Responsive Design (see responsive-design.md)

## Checklist

- [ ] Mobile layout built and validated first
- [ ] Touch targets >= 44px with adequate spacing
- [ ] No hover-only access to critical content
- [ ] Critical flows tested at mobile width

## Common Pitfalls

- Desktop-first design retrofitted for mobile
- Hover-only menus/tooltips hiding important content on touch devices
- Cramped touch targets under 44px
