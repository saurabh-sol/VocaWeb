# Image Generation

**Purpose:** Use Vocaweb-generated images in Next.js sites via OpenAI gpt-image-1.

**When to use:** Hero sections, feature blocks, product grids, portfolios, and any site that needs real visuals.

## Pre-Generated Assets

Vocaweb may pre-generate images before codegen. When these paths exist, you MUST use them:

- `public/images/hero.jpg` → hero section (`/images/hero.jpg`)
- `public/images/feature-1.jpg` → primary feature or product visual
- `public/images/feature-2.jpg` → secondary visual

Never substitute colored placeholder divs or gradient boxes when these files are available.

## next/image Usage

```tsx
import Image from 'next/image';

<Image
  src="/images/hero.jpg"
  alt="Descriptive alt text"
  width={1536}
  height={1024}
  className="w-full h-auto object-cover"
  priority
/>
```

## Core Principles

- Always use `next/image` with explicit `width` and `height` (or `fill` with a sized parent)
- Reserve aspect ratio to prevent layout shift — use `aspect-video`, `aspect-square`, or fixed dimensions
- Match imagery style consistently across the site
- Write meaningful `alt` text for accessibility
- Use `priority` on above-the-fold hero images
- Compress via next/image — do not embed base64 in JSX

## Checklist

- [ ] All photos use `next/image`, not `<img>` or placeholder divs
- [ ] Pre-generated paths from `public/images/` are referenced when provided
- [ ] Aspect ratio reserved on every image container
- [ ] Consistent visual style across hero, features, and gallery sections

## Common Pitfalls

- Gray/colored div placeholders instead of real generated images
- Missing `width`/`height` causing layout shift
- Mixing illustration and photography styles inconsistently
- Using external hotlinked URLs when local `/images/` assets exist
