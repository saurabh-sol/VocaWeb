# VocaWeb

**Build websites by talking or typing.** VocaWeb is an AI-powered website builder — describe what you want in chat or voice, watch it build live, then publish to the web in one click.

## Architecture

| App | Path | Default port | Deploy target |
|-----|------|--------------|---------------|
| **Dashboard** | `apps/dashboard` | 3002 | Vercel (`app.yourdomain.com`) |
| **API** | `apps/api` | 3001 | Render (`api.yourdomain.com`) |

Shared packages live under `packages/` (`ai`, `db`, `shared`, `voice`).

User-published sites deploy to Vercel as `{slug}.yourdomain.com` via the API deploy pipeline.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+ (`corepack enable`)
- **PostgreSQL** (Neon recommended)
- **Redis**

## Quick start

```bash
# Install dependencies
pnpm install

# Copy env template and fill in secrets
cp .env.example .env
# Dashboard local env
cp apps/dashboard/.env.example apps/dashboard/.env.local 2>/dev/null || true

# Run API + dashboard (from repo root)
pnpm dev
```

- Dashboard: http://localhost:3002  
- API: http://localhost:3001  

## Environment variables

See [`.env.example`](.env.example) for the full API template.

**Dashboard** (`apps/dashboard/.env.local`):

```env
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_DEPLOY_BASE_DOMAIN=drooper.xyz
```

**API (Render / production)** — minimum:

```env
DATABASE_URL=
REDIS_URL=
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=
VERCEL_TOKEN=
DEPLOY_BASE_DOMAIN=drooper.xyz
WEB_APP_URL=https://app.yourdomain.com
INTEGRATIONS_CALLBACK_BASE=https://api.yourdomain.com
```

## Features

- **Chat & voice builder** — plan and generate sites with AI (v1 HTML, v2 React/Vite, v3 Next.js tiers)
- **Live sandbox** — preview, edit code, click-to-select elements
- **One-click publish** — deploy to Vercel with stable `*.vercel.app` URLs + optional custom subdomains
- **Integrations** — Notion, Figma, Canva import via OAuth
- **Wallet auth** — Privy + Solana (Phantom, Solflare, Backpack)

## Project structure

```
apps/
  api/          Fastify backend (AI, deploy, auth, integrations)
  dashboard/    Next.js app (UI)
packages/
  ai/           LLM providers, skills loader
  db/           Postgres repositories
  shared/       Shared types & schemas
  voice/        Voice agent tools
skills/         AI skill markdown files
docs/           MCP & integration docs
```

## SDK folders (not in this repo)

Local SDK packages are **gitignored** and kept on your machine only:

- `Drooper_sdk_python/`
- `Drooper_sdk_typescript/`
- `Vocaweb_sdk_python/`
- `Vocaweb_sdk_typescript/`

Use them separately if you need programmatic API access.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint workspace |
| `pnpm typecheck` | Typecheck workspace |
| `pnpm db:migrate` | Run database migrations |

## Deployment

1. **API** → Render (see `render.yaml` blueprint)
2. **Dashboard** → Vercel, root directory `apps/dashboard`
3. **DNS** — point `api.*` to Render, `app.*` to Vercel; wildcard `*` for user sites on Vercel
4. Register OAuth redirect URIs on Notion/Figma/Canva pointing to `https://api.yourdomain.com/api/integrations/.../callback`

## License

Private — All rights reserved.
