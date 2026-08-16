# Charts Best Practices (Deep Dive)

**Purpose:** Deeper visualization craft rules beyond basic chart selection.

**When to use:** When chart quality/clarity matters (dashboards, reports, data products).

## Core Principles

- Start bar chart y-axes at zero — truncated axes exaggerate differences misleadingly.
- Sort categorical bar charts by value (not alphabetically) unless there's a meaningful inherent order (e.g. time, size tiers).
- Reduce chart 'ink' — remove unnecessary gridlines, borders, and 3D effects that don't add information.
- Highlight the single most important data point/series with color; keep the rest neutral gray.
- Use annotations directly on the chart for key events/thresholds instead of relying only on a legend.

## Reference Sources

- Storytelling with Data — general data-viz practice references

## Checklist

- [ ] Bar chart axes start at zero
- [ ] Unnecessary chart decoration removed
- [ ] Key series highlighted, rest kept neutral

## Common Pitfalls

- Truncated y-axes that mislead
- 3D/heavily decorated charts obscuring the data
- No visual hierarchy among multiple series
