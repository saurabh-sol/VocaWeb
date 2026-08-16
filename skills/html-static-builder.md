# HTML Static Builder — Vocaweb v1 Skill

**Purpose:** Guide planning and code generation for Vocaweb v1 (plain HTML/CSS/JS tier).

**When to use:** Any v1 build, `html` framework tier, or when the active model tier is Vocaweb v1.

---

## Output Contract

- **One file only:** `index.html`
- Inline `<style>` for all CSS
- Inline `<script>` for all JavaScript (at end of `<body>`)
- No separate `.css`, `.js`, or asset files
- No `package.json`, no build step, no npm

---

## Allowed Stack

| Layer | Allowed |
|-------|---------|
| Markup | HTML5 semantic tags (`header`, `nav`, `main`, `section`, `article`, `footer`) |
| Styles | CSS3 — flexbox, grid, custom properties, `clamp()`, media queries, transitions, keyframe animations |
| Scripts | Vanilla ES6+ JavaScript — DOM APIs, `IntersectionObserver`, smooth scroll, mobile menu toggle |
| Fonts | Google Fonts via `<link>` in `<head>` |
| Icons | Inline SVG or Unicode symbols |
| Images | `https://placehold.co/...` placeholders, or `/images/hero.jpg` when platform provides generated assets |

---

## Forbidden (Never Use on v1)

- React, JSX, components, hooks
- Next.js, Vite, Vue, Svelte, Angular
- TypeScript, npm, package.json, node_modules
- Tailwind CSS, shadcn/ui, Bootstrap, Material UI
- Framer Motion, GSAP, or any animation library
- Multi-page routing or separate HTML files
- Backend APIs, auth, databases, payment processing

When planning v1 sites, describe animations as **CSS transitions**, **CSS keyframes**, or **vanilla JS scroll effects** — never Framer Motion or React libraries.

---

## Plan Template (v1)

Every v1 build plan MUST include:

```
Project Name — [Creative Name]
Design read: [one-line interpretation]

Framework: Plain HTML + CSS + JavaScript (single index.html)
Typography: [Font names + weights via Google Fonts CDN]
Palette: [4-5 hex values with roles]
Layout: [Named pattern + reasoning]

1. [Section] — [content purpose + design detail]
2. ...

Features: CSS media queries for responsive 320px–1440px, CSS hover/transitions, vanilla JS mobile nav, semantic HTML, meta description for SEO
```

The **Framework** line must always read HTML/CSS/JS — never Next.js or React.

---

## Code Quality Rules

1. **Mobile-first CSS** — base styles for small screens, `@media (min-width: 768px)` for tablet/desktop
2. **CSS variables** — define colors, spacing, and radii in `:root { --primary: #...; }`
3. **Accessible markup** — `alt` on images, `aria-label` on icon buttons, sufficient color contrast
4. **Performance** — no heavy external JS; keep scripts minimal
5. **Hamburger menu** — toggle class on nav with vanilla JS click handler
6. **Scroll effects** — use `IntersectionObserver` or CSS `scroll-behavior: smooth`
7. **Rounded corners** — use consistent border-radius (e.g. 14px for cards and buttons)

---

## v1 Plan Example (GOOD)

```
Sports Shop — Athletic Retail Landing
Design read: sports retail for active shoppers, crisp and energetic, leaning blue-white athletic brand

Framework: Plain HTML + CSS + JavaScript (single index.html)
Typography: Outfit (700/800 headings) + DM Sans (400/500 body) via Google Fonts
Palette: #0757D8 primary, #08213F navy text, #FFFFFF bg, #EAF3FF ice panels, #5E7187 muted body
Layout: Full-bleed hero with left-aligned text overlay, product preview below fold

1. Hero — athletic imagery, "Sports Shop" headline, value copy, primary "Shop Now" CTA, blue gradient overlay for text readability
2. Categories — 3-card grid (Running, Training, Outdoor) with hover lift via CSS transform
3. Featured Products — ice-blue panel, 4 product cards with image, name, price
4. Newsletter — email input + CTA, navy footer base

Features: CSS grid/flexbox responsive layout, CSS transitions on hovers, vanilla JS hamburger for mobile nav, semantic HTML5, meta tags for SEO
```

---

## v1 Plan Example (BAD — Do Not Produce)

```
Framework: Next.js 15 + Tailwind CSS
Features: Framer Motion animations, next/font loading, shadcn components
```

This is wrong for v1 — it will break deployment.

---

## Deployment Note

v1 sites deploy as **static HTML** on Vercel with no build command. A single valid `index.html` is all that is required. Keep the output self-contained and deployable without any compilation step.
