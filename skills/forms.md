# Forms

**Purpose:** Build usable, validated, accessible forms.

**When to use:** Whenever the site includes an input form (signup, contact, checkout, settings).

## Core Principles

- Validate on both client (immediate feedback) and server (source of truth) — never trust client-only validation.
- Show inline, field-level error messages next to the relevant field, not just a generic banner at the top.
- Group related fields visually and use a single-column layout for most forms (multi-column hurts scanability).
- Mark required fields clearly and keep the required field count as low as possible.
- Preserve user input on validation error — never clear the form and make the user retype everything.

## Reference Sources

- web.dev forms guidance — https://web.dev/learn/forms/

## Checklist

- [ ] Client + server validation both present
- [ ] Inline field-level error messages
- [ ] Single-column layout for most forms
- [ ] Input preserved after a failed submission

## Common Pitfalls

- Server accepting unvalidated client input
- Generic top-of-page-only error banners
- Form wiped after a failed validation attempt
