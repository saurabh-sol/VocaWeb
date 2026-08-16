# Dashboard Specialist

**Purpose:** Build data-dense dashboard UI: charts, tables, filters, KPIs.

**When to use:** When the deliverable is an analytics/admin dashboard.

## Core Principles

- Lead with the 3-5 most important KPIs at the top, above detailed tables/charts.
- Match chart type to data: trends -> line, comparisons -> bar, part-to-whole -> stacked bar/pie (sparingly), distribution -> histogram.
- Tables need sorting, filtering, and pagination for anything beyond ~20 rows.
- Use consistent color coding for status/category across all charts and tables on the dashboard.
- Provide date-range and filter controls that persist as the user navigates between dashboard views.
- Use skeleton loading states for async data — never a blank dashboard while data loads.

## Reference Sources

- Tremor — https://www.tremor.so/
- shadcn dashboard blocks — https://ui.shadcn.com/blocks

## Checklist

- [ ] Key KPIs surfaced at the top
- [ ] Chart type matches the data relationship being shown
- [ ] Tables support sort/filter/pagination
- [ ] Consistent color coding for status across the dashboard

## Common Pitfalls

- Pie charts for too many categories (unreadable)
- Unsortable/unfilterable tables with hundreds of rows
- Inconsistent color meaning between charts
