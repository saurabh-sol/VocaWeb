# MCP Import Skill

When building from imported Notion, Canva, or Figma sources with MCP enabled:

## Priority

1. **Pre-merged ImportBundle** in the build prompt is the primary source of truth (markdown, design tokens, layout summary, assets).
2. **MCP enrichment** adds richer context when REST export is thin — prefer bundled content over re-fetching.
3. **Figma bridge** provides layout trees and color/font tokens — map FRAME nodes to page sections.
4. **Notion MCP** markdown should become hero copy, H2 sections, and feature bullets verbatim where possible.
5. **Canva MCP** exports become hero/background images at paths listed in IMPORTED ASSETS.

## Codegen rules

- Match design tokens in CSS variables within `globals.css` (Tailwind 4 — no tailwind.config file) when colors/fonts are provided.
- Use imported PNG paths exactly as given (`public/import/...`).
- Do not invent copy when Notion markdown is present — structure the page around it.
- When Figma layout summary shows nested FRAMEs, mirror section hierarchy in component tree.
- If MCP notes mention REST fallback, still honor whatever content arrived in the bundle.

## Agent tools (when MCP connected mid-build)

- `integration_search_notion` — lookup additional Notion pages by query
- `integration_figma_context` — refresh frame layout from Figma file key
- `integration_canva_export` — re-export Canva design assets

Prefer the pre-merged bundle unless the user asks to pull fresh context.
