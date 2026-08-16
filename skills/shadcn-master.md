# shadcn/ui Master

**Purpose:** Correctly use, theme, and extend shadcn/ui components.

**When to use:** Any time shadcn/ui components are added, styled, or customized.

## Core Principles

- shadcn/ui components are copied into the project (not an npm dependency) — edit them directly as needed.
- Use the CLI (`npx shadcn add <component>`) to scaffold components rather than hand-writing them from scratch.
- Theme via CSS variables in `globals.css` (Tailwind 4 uses CSS-first config, not tailwind.config) — never hardcode colors inside component files.
- Compose complex UI (e.g. data tables, command palettes) from primitives (Dialog, Popover, Command) rather than building from scratch.
- Respect built-in accessibility (Radix primitives underneath) — don't strip aria attributes or keyboard handling.
- Use `cn()` utility for conditional className merging instead of string concatenation.
- Keep variant logic in `class-variance-authority` (cva) patterns already established by the generated components.

## Reference Sources

- shadcn/ui — https://ui.shadcn.com/
- GitHub — https://github.com/shadcn-ui/ui

## Checklist

- [ ] Components added via CLI, not hand-copied
- [ ] Theming done via CSS variables, not inline overrides
- [ ] cn() used for conditional classes
- [ ] Accessibility attributes preserved

## Common Pitfalls

- Hardcoding colors instead of using theme tokens
- Rebuilding components shadcn already provides
- Removing Radix accessibility props to 'simplify' code
