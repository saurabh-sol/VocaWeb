# Charts

**Purpose:** Implement data visualizations in the UI.

**When to use:** When the app needs to render charts/graphs (often via Tremor, Recharts, or similar).

## Core Principles

- Choose chart type by the relationship in the data: trend over time -> line/area, comparison -> bar, part-to-whole -> stacked bar (avoid pie beyond ~5 slices).
- Always label axes and provide a legend when more than one series is shown.
- Use a consistent, accessible color palette across all charts in the app (see color-theory.md).
- Show loading and empty states for charts — never render an empty/broken chart while data is missing.
- Keep tooltips concise: show the exact value and label on hover/tap, not extra clutter.

## Reference Sources

- Tremor — https://www.tremor.so/
- Recharts — https://recharts.org/

## Checklist

- [ ] Chart type matches the data relationship
- [ ] Axes labeled, legend present when needed
- [ ] Loading/empty states handled explicitly

## Common Pitfalls

- Pie charts with many thin slices
- Unlabeled axes
- Charts rendered blank while data is still loading
