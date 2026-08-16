# Component Generator

**Purpose:** Decide which component library/pattern to use when generating new UI pieces.

**When to use:** Whenever a new UI component is needed and there's a choice of source library.

## Core Principles

- Default order of preference: shadcn/ui (functional/base) -> MagicUI (marketing/motion) -> Aceternity (advanced visual effects) -> OriginUI (extra variants) -> custom.
- Never rebuild a component from scratch if an accessible, themeable version already exists in the library set.
- Match the component's purpose to its source: forms/tables/dialogs -> shadcn; hero/landing flourishes -> MagicUI/Aceternity.
- Keep a consistent design language — don't mix drastically different visual styles from different libraries on one page.
- When customizing a library component, keep changes minimal and documented so future updates don't get lost.

## Reference Sources

- shadcn/ui — https://ui.shadcn.com/
- MagicUI — https://magicui.design/
- Aceternity — https://ui.aceternity.com/
- OriginUI — https://originui.com/

## Checklist

- [ ] Checked existing libraries before hand-building a component
- [ ] Component source matches its functional role
- [ ] Visual style consistent with rest of page

## Common Pitfalls

- Reinventing components that already exist in the library set
- Mixing incompatible visual styles across sections
