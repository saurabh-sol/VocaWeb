# Deployment

**Purpose:** Ship the site correctly to production infrastructure.

**When to use:** When the user asks to deploy, containerize, or configure hosting/CI.

## Core Principles

- Vercel is the default target for Next.js apps (zero-config, edge network, preview deployments per PR).
- Use environment variables for all secrets/config — never commit `.env` files.
- Set up preview deployments for every branch/PR before merging to production.
- For containerized deployments, use multi-stage Docker builds to keep production images small.
- Cloudflare Pages/Netlify are solid alternatives when the user needs specific edge/CDN features Vercel doesn't offer.
- Always configure a custom domain, HTTPS (usually automatic), and basic caching headers before calling a deploy 'done'.

## Reference Sources

- Docker Docs — https://docs.docker.com/
- Vercel Docs — https://vercel.com/docs
- Cloudflare Docs — https://developers.cloudflare.com/
- Netlify Docs — https://docs.netlify.com/

## Checklist

- [ ] Secrets in env vars, not committed to repo
- [ ] Preview deployments enabled
- [ ] HTTPS + custom domain configured
- [ ] Production build tested locally before deploy

## Common Pitfalls

- Committing .env files with secrets
- Deploying straight to production with no preview/staging
- Oversized Docker images from single-stage builds
