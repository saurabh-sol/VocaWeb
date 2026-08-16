# Bento Grid

**Purpose:** Build modular bento-box style feature/showcase grids.

**When to use:** When a features/showcase section calls for a modern asymmetric grid layout.

## Core Principles

- Use CSS Grid with defined `grid-template-columns`/`grid-template-areas` or explicit `col-span`/`row-span` per tile.
- Vary tile sizes to create visual hierarchy — the most important feature gets the largest tile.
- Keep consistent gutter/gap and corner radius across all tiles for cohesion.
- Each tile should contain one focused idea (icon/visual + short headline + 1-line description).
- Ensure the grid degrades gracefully to a single column on mobile.

## Reference Sources

- Bento grid pattern references — Land-book, Mobbin

## Checklist

- [ ] Tile sizes reflect content importance
- [ ] Consistent gap/radius across tiles
- [ ] Graceful single-column collapse on mobile

## Common Pitfalls

- Uniform-size tiles that lose the bento hierarchy effect
- Grid breaking or overflowing on small screens
