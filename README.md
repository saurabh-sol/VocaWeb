# VocaWeb

**Build websites by talking or typing.** Describe the site in chat or out loud, approve the plan, watch a live preview and publish it to the web.

## Architecture

| App | Path | Default port | Deploy target |
|-----|------|--------------|---------------|
| **Dashboard** | `apps/dashboard` | 3002 | Render, https://vocaweb.onrender.com |
| **API** | `apps/api` | 3001 | Render, https://vocaweb-api.onrender.com |

Shared packages live under `packages/` (`ai`, `db`, `shared`, `voice`).

| Concern | How it works |
|---------|--------------|
| Sign-in | Clerk, with Google and GitHub |
| AI | Every model call goes through the Vercel AI Gateway from the API. The browser never sees the key. |
| Usage | Each account gets a daily build allowance (`FREE_DAILY_BUILDS`, default 10) |
| Publishing | User sites deploy to Vercel as `{slug}.yourdomain.com` |

### Models

| Task | Model | Falls back to |
|------|-------|---------------|
| Website generation, edits | `google/gemini-2.5-flash` | `openai/gpt-5.5`, `anthropic/claude-sonnet-4.6` |
| Debugging and fixes | `anthropic/claude-sonnet-4.6` | `google/gemini-2.5-flash` |
| Chat and planning | `openai/gpt-5.5` | `anthropic/claude-sonnet-4.6` |
| Images | `openai/gpt-image-1` | none |

Realtime voice talks to xAI directly.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+ (`corepack enable`)
- **PostgreSQL** (Neon recommended)
- **Redis** (optional, speeds up chat history)
- A **Clerk** application with Google and GitHub enabled
- A **Vercel AI Gateway** API key with credit

## Quick start

```bash
pnpm install

# API environment
cp .env.example .env

# Dashboard environment
cp apps/dashboard/.env.example apps/dashboard/.env.local

pnpm db:migrate
pnpm dev
```

- Dashboard: http://localhost:3002
- API: http://localhost:3001

### Setting up Clerk

1. Create an application at https://dashboard.clerk.com.
2. Under **SSO connections**, enable **Google** and **GitHub** and turn the other sign-in methods off.
3. Copy the publishable key and the secret key from **API keys**:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `apps/dashboard/.env.local`
   - `CLERK_SECRET_KEY` in `.env` for the API
4. For production, add your own Google and GitHub OAuth credentials in Clerk. Development instances use shared ones.

### Setting up the AI Gateway

1. Create a key at https://vercel.com/dashboard/ai-gateway and add credit.
2. Set `AI_GATEWAY_API_KEY` in `.env` for the API only.

## Pages

| Path | What it is |
|------|------------|
| `/` | Landing page |
| `/sign-in`, `/sign-up` | Google and GitHub sign-in. The form sits on the right for sign-in and on the left for sign-up. |
| `/app` | Builder: chat, voice, projects and the sandbox |
| `/app/chat-history` | Past chat and voice sessions |
| `/app/settings` | Account, usage, integrations and appearance |

## Design system

The look is a "paper ledger": warm paper, ink rules, hard offset shadows, Space Grotesk for headings, Inter for text and IBM Plex Mono for labels. Tokens for light and dark live in `apps/dashboard/src/app/globals.css`, and the building blocks are in `apps/dashboard/src/components/ui`.

## Project structure

```
apps/
  api/          Fastify backend (AI, publishing, sign-in checks, integrations)
  dashboard/    Next.js app (landing page and builder)
packages/
  ai/           AI Gateway provider, model routing, skills loader
  db/           Postgres repositories and migrations
  shared/       Shared types and schemas
  voice/        Voice agent tools
skills/         AI skill markdown files
docs/           MCP and integration docs
```

## SDK folders (not in this repo)

Local SDK packages are **gitignored** and kept on your machine only:

- `Drooper_sdk_python/`
- `Drooper_sdk_typescript/`
- `Vocaweb_sdk_python/`
- `Vocaweb_sdk_typescript/`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint workspace |
| `pnpm typecheck` | Typecheck workspace |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Run database migrations |

## Deployment

Both apps run on Render as web services built from this repository (see `render.yaml`). Pushing to `main` redeploys them.

| Service | Build | Start |
|---------|-------|-------|
| `vocaweb-api` | `pnpm install` | `pnpm --filter @theo/api exec tsx src/server.ts` |
| `vocaweb` | `pnpm install` then `pnpm --filter @theo/dashboard build` | `pnpm --filter @theo/dashboard start` |

1. Set every variable marked `sync: false` in the Render dashboard.
2. `WEB_APP_URL` and `CLERK_AUTHORIZED_PARTIES` on the API must be the website's address, or sign-in tokens and CORS are refused.
3. `NEXT_PUBLIC_*` values are read when the website builds, so redeploy it after changing one.
4. Run `pnpm db:migrate` against the database after pulling new migrations.
5. Register the OAuth redirect URIs for Notion, Figma and Canva as `https://vocaweb-api.onrender.com/api/integrations/{provider}/callback`.
6. User sites still publish to Vercel through `VERCEL_TOKEN`.

## License

Private. All rights reserved.
