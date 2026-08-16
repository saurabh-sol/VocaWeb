# Database Design

**Purpose:** Design relational/NoSQL schemas that support the app cleanly.

**When to use:** When defining or evolving a data model.

## Core Principles

- Normalize relational data to avoid duplication, then denormalize deliberately only for measured performance needs.
- Every table needs a clear primary key and explicit foreign key relationships with appropriate cascade rules.
- Index columns used in frequent WHERE/JOIN/ORDER BY clauses.
- Use migrations for every schema change — never hand-edit a production schema directly.
- Choose NoSQL only when the access pattern genuinely benefits from it (flexible/nested documents, extreme write scale), not by default.

## Reference Sources

- Prisma docs (as a practical ORM/migration reference) — https://www.prisma.io/docs

## Checklist

- [ ] Primary/foreign keys and relationships explicit
- [ ] Indexes added for frequent query patterns
- [ ] Schema changes done via migrations

## Common Pitfalls

- Unindexed columns used in hot query paths
- Direct manual edits to production schema
- Choosing NoSQL/relational by default habit rather than actual access pattern fit
