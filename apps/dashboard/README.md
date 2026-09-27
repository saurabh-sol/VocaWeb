# VocaWeb Dashboard

The Next.js app: the landing page, sign-in, and the builder.

## How it works

1. **Sign in** with Google or GitHub.
2. **Describe your website** in chat or by voice.
3. **Approve the plan**, then watch the site build in a live preview.
4. **Publish** to a live address.

## Running it

```bash
cp .env.example .env.local   # then add your Clerk keys
pnpm dev                     # http://localhost:3002
```

The API must be running too (`apps/api`, port 3001).

## Models

VocaWeb v1 builds plain HTML, CSS and JavaScript and is free for every account. v2 (React) and v3 (Next.js) are listed in the model picker as coming soon.

Each account has a daily build allowance. Builds and AI edits count; chatting and planning do not. The current balance is under **Settings, Usage**.

## Screens

| Screen | Path | Notes |
|--------|------|-------|
| Landing | `/` | Live build demo, how it works, features, scope, FAQ |
| Sign in / sign up | `/sign-in`, `/sign-up` | One shared screen whose halves swap sides |
| Build | `/app` | Chat or voice, with a plan to approve before building |
| Projects | `/app` | Every saved site |
| Sandbox | `/app` | Live preview, file list, code, click-to-edit and publish |
| History | `/app/chat-history` | Resume any chat or voice session |
| Settings | `/app/settings` | Account, usage, integrations, appearance |

## Design system

| Piece | Where |
|-------|-------|
| Colour, type and shadow tokens (light and dark) | `src/app/globals.css` |
| Buttons, cards, fields, tags, modal, empty states | `src/components/ui` |
| Motion helpers (reveal, magnetic, spotlight) | `src/components/ui/motion.tsx` |
| Landing sections | `src/components/landing` |

Every animation respects the reduced-motion setting.

## Notes

- Pages under `/app` are served with cross-origin isolation headers, which the in-browser sandbox needs for React and Next.js projects. The landing and sign-in pages are not, so third-party frames such as Clerk's bot check can load.
- The API bearer token comes from Clerk through `useAuthSession` in `src/lib/auth.ts`.
