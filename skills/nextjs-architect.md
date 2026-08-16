# Next.js Architect

**Purpose:** Structure Next.js (App Router) projects correctly: routing, rendering strategy, data fetching, metadata, SEO.

**When to use:** Whenever scaffolding, extending, or refactoring a Next.js project.

## Core Principles

- Default to the App Router (`app/`) unless the user explicitly needs Pages Router for legacy reasons.
- Prefer Server Components by default; only add `'use client'` when you need state, effects, or browser APIs.
- Co-locate route logic: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` inside the route folder.
- Use `generateMetadata` for dynamic SEO metadata instead of manual `<head>` tags.
- Fetch data in Server Components directly (async/await) rather than client-side `useEffect` fetches when possible.
- Use Route Handlers (`route.ts`) for API endpoints, not a separate Express server, unless there's a strong reason.
- Use `next/image` and `next/font` for automatic optimization — never raw `<img>` or manual font links.
- Structure folders by feature when the app grows past ~15 routes, not purely by type.

## Reference Sources

- Next.js Docs — https://nextjs.org/docs
- Next.js Examples — https://github.com/vercel/next.js/tree/canary/examples

## Checklist

- [ ] Confirm App Router structure (app/, layout.tsx, page.tsx)
- [ ] Mark client components explicitly and minimally
- [ ] Add generateMetadata for each route that needs SEO
- [ ] Use next/image and next/font
- [ ] Add loading.tsx / error.tsx for routes with async data

## Common Pitfalls

- Overusing 'use client' on components that don't need it
- Fetching data client-side when a Server Component would do
- Skipping metadata, hurting SEO
- Mixing Pages Router and App Router patterns
