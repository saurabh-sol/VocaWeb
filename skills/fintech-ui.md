# Fintech UI

**Purpose:** Design UI patterns for financial products (banking, budgeting, trading).

**When to use:** When building account balances, transactions, or money-movement interfaces.

## Core Principles

- Never let ambiguity exist around money direction — use clear +/- and color (with icon, not color alone) for credits/debits.
- Show exact amounts with currency and correct decimal precision everywhere; avoid rounding that hides real values.
- Require explicit confirmation steps (and often a summary review) before any money-moving action.
- Surface security context (last login, device, masked account numbers) to build trust.
- Use empty/loading states carefully — never show a $0 balance ambiguously while data is still loading.

## Reference Sources

- Nielsen Norman Group fintech UX research

## Checklist

- [ ] Money direction unambiguous (icon + color, not color alone)
- [ ] Exact amounts shown with correct precision
- [ ] Explicit confirmation step before money movement
- [ ] Loading states never mistakable for a real $0 balance

## Common Pitfalls

- Color-only signals for credit/debit (fails colorblind users)
- One-click irreversible money movement with no confirmation
- Loading state indistinguishable from a real zero balance
