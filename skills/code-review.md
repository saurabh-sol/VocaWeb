# Code Review

**Purpose:** Review code changes for correctness, clarity, and maintainability before merging.

**When to use:** When reviewing a diff/PR or self-reviewing generated code before presenting it.

## Core Principles

- Prioritize correctness and design first; nitpick style/formatting last (and prefer automated formatters for that).
- Ask 'is this the simplest solution that fully solves the problem' before approving added complexity.
- Flag missing error handling, edge cases, and untested logic paths.
- Prefer requesting changes with a clear reason and suggested alternative over vague criticism.
- Check that naming clearly reflects intent — unclear names are treated as a design smell, not a nitpick.
- Small, focused diffs are reviewed faster and more reliably than large sprawling ones — split when possible.

## Reference Sources

- Google Engineering Practices — https://google.github.io/eng-practices/review/

## Checklist

- [ ] Correctness and edge cases checked first
- [ ] Naming reflects intent clearly
- [ ] Diff is focused/small where possible
- [ ] Feedback includes concrete suggestions, not just criticism

## Common Pitfalls

- Nitpicking formatting instead of using an auto-formatter
- Approving without checking edge cases/error handling
- Reviewing sprawling multi-purpose diffs
