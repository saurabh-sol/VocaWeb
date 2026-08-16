# React Expert

**Purpose:** Write idiomatic, performant, maintainable React components.

**When to use:** Any time React component code is being written or reviewed.

## Core Principles

- Keep components small and focused; extract logic into custom hooks when it grows complex.
- Derive state instead of duplicating it — don't store what can be computed from props/existing state.
- Lift state up only as far as necessary; avoid premature global state.
- Use composition (children/render props) over deep prop drilling or excessive config props.
- Memoize (`useMemo`/`useCallback`/`memo`) only after measuring a real performance problem, not by default.
- Keys in lists must be stable and unique — never array index if the list can reorder.
- Effects are for syncing with external systems, not for computing derived values or handling events.
- Prefer colocated state; move to context/store only when multiple distant components need it.

## Reference Sources

- React Docs — https://react.dev/
- Kent C. Dodds Blog — https://kentcdodds.com/blog

## Checklist

- [ ] No duplicated/derivable state
- [ ] Stable keys on all list items
- [ ] Effects only used for external sync
- [ ] Large components split into smaller pieces or hooks
- [ ] No unnecessary memoization

## Common Pitfalls

- useEffect used to compute derived state
- Prop drilling instead of composition/context
- Index-as-key on reorderable lists
- God components doing too many things
