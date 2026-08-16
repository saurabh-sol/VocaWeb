# Backend Architecture

**Purpose:** Structure backend/API logic behind the generated frontend.

**When to use:** When the site needs server-side logic beyond static content.

## Core Principles

- Use Next.js Route Handlers for simple APIs; use a dedicated backend service only when the workload genuinely needs it.
- Separate concerns: route handler -> validation -> service/business logic -> data access layer.
- Validate all incoming input (e.g. with zod) at the API boundary before it touches business logic.
- Keep business logic framework-agnostic (plain functions/services) so it's testable outside the HTTP layer.
- Return consistent, typed API response shapes (including error shape) across all endpoints.

## Reference Sources

- Next.js Route Handlers docs — https://nextjs.org/docs/app/building-your-application/routing/route-handlers

## Checklist

- [ ] Input validated at the API boundary
- [ ] Business logic separated from route handler code
- [ ] Consistent response/error shape across endpoints

## Common Pitfalls

- Business logic embedded directly inside route handlers with no separation
- Unvalidated input passed straight to the database layer
