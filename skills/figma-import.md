# Figma Import Skill

When building from Figma imports:

- Match colors from design tokens exactly in Tailwind (`bg-[#hex]`, CSS variables in `:root`).
- Match font families from tokens; use `next/font/google` for web-safe equivalents.
- Respect layout hierarchy from the Figma summary (frames → sections → components).
- Use imported PNG assets from `public/import/` for hero and section backgrounds where provided.
- Prefer flex/grid layouts that mirror Figma frame widths; use responsive breakpoints for mobile.
- Do not recreate every Figma layer — translate to semantic HTML sections (header, hero, features, footer).
- Spacing: use consistent `py-16`, `px-6`, `gap-8` patterns aligned with Figma frame padding when known.
