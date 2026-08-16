# Frontend Architecture

**Purpose:** Structure a frontend codebase for maintainability as it grows.

**When to use:** When scaffolding a project or refactoring a growing codebase.

## Core Principles

- Organize by feature/domain folders once the project passes ~15-20 components, not purely by type (all components/, all hooks/).
- Keep a clear boundary between UI components (dumb/presentational) and containers/hooks that hold logic and data fetching.
- Centralize shared types/constants/utilities in a `lib/` or `shared/` folder to avoid duplication.
- Keep component files under ~200-300 lines; split when they grow beyond that.
- Establish clear import conventions (absolute imports via path aliases) instead of long relative `../../../` chains.

## Reference Sources

- Bulletproof React — https://github.com/alan2207/bulletproof-react

## Checklist

- [ ] Feature-based structure once project grows
- [ ] Presentational vs logic-holding components separated
- [ ] Path aliases used instead of deep relative imports

## Common Pitfalls

- Flat, type-based folder structure that doesn't scale
- Giant files mixing data-fetching, state, and rendering
