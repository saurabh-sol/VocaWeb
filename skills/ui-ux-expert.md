# UI/UX Expert

**Purpose:** Apply cross-platform interaction design and usability standards.

**When to use:** When designing interactive flows, forms, or evaluating usability of a generated UI.

## Core Principles

- Follow Fitts's Law: make frequently used targets large and close to where the user already is.
- Follow Hick's Law: reduce choices at any decision point to speed up user action.
- Maintain consistency: same action should always look and behave the same way across the app.
- Give immediate feedback for every user action (hover, click, loading, success, error states).
- Design for the error/empty/loading states first, not just the happy path.
- Respect platform conventions (iOS vs Material) when building platform-specific or native-feeling UI.
- Text contrast and touch target size (min ~44px) are usability requirements, not nice-to-haves.

## Reference Sources

- Refactoring UI — https://www.refactoringui.com/
- Apple HIG — https://developer.apple.com/design/human-interface-guidelines/
- Material Design — https://m3.material.io/

## Checklist

- [ ] Empty, loading, and error states designed for every view
- [ ] Consistent interaction patterns across the app
- [ ] Touch targets >= 44px
- [ ] Feedback present for every interactive action

## Common Pitfalls

- Only designing the happy path
- Inconsistent button/link styling across pages
- Tiny tap targets on mobile
- Silent actions with no feedback
