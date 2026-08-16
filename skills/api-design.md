# API Design

**Purpose:** Design clean, predictable HTTP/API contracts.

**When to use:** When defining new API routes/endpoints.

## Core Principles

- Use resource-oriented, plural nouns for routes (`/api/users`, `/api/users/:id`), not verb-based routes.
- Use correct HTTP methods and status codes (GET/POST/PATCH/DELETE, 200/201/400/401/404/500) consistently.
- Version APIs from the start if third parties will consume them (`/api/v1/...`).
- Paginate list endpoints by default rather than returning unbounded arrays.
- Document request/response shapes (even lightweight inline comments/types) so the frontend contract is explicit.

## Reference Sources

- REST API design references — Microsoft REST API Guidelines, Stripe API docs (as a UX-of-APIs reference)

## Checklist

- [ ] Resource-based route naming, correct HTTP verbs/status codes
- [ ] List endpoints paginated
- [ ] Request/response shapes typed and documented

## Common Pitfalls

- Verb-based inconsistent routes
- Unbounded list endpoints with no pagination
- Inconsistent status codes for the same error type across endpoints
