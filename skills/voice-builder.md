# Voice Builder

**Purpose:** Optimize codegen for voice-triggered website builds.

**When to use:** Voice channel builds only.

## Core Principles

- Generate complete, runnable Next.js 15 projects in one pass — voice users cannot paste code manually.
- Every interactive component MUST start with `"use client"` — never use onMouseEnter/onClick in Server Components.
- Use pre-generated images from `public/` when provided — reference with `next/image` and explicit width/height.
- Prefer CSS `:hover` over JavaScript hover handlers when possible.
- Keep file count under 25; favor single rich `page.tsx` over many routes for landing sites.
- Include `package.json` with `"next": "15.5.20"` (exact, latest security-patched 15.x).
- Never output placeholder divs where real images exist in `public/`.

## Checklist

- [ ] `"use client"` on any file with event handlers or hooks
- [ ] `next/image` for all photos with aspect ratio reserved
- [ ] Mobile-first responsive layout
- [ ] No backend/API routes unless explicitly requested

## Common Pitfalls

- Server Component event handler errors in live preview
- Missing `"use client"` on animated or interactive sections
- Describing HTML in comments instead of implementing it
