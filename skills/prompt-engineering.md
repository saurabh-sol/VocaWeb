# Prompt Engineering (for the agent itself)

**Purpose:** Guide how the AI agent should interpret and expand user prompts into build plans.

**When to use:** At the start of handling any user request to the website builder.

## Core Principles

- Extract explicit requirements first (pages, features, brand, content) before inferring anything.
- For vague prompts, make and state reasonable assumptions (industry, tone, color) rather than blocking on questions.
- Break the build into a plan (pages -> sections -> components) before generating code.
- Ask at most one clarifying question, and only if proceeding would clearly go the wrong direction.
- Re-check the final output against the original prompt's explicit requirements before presenting it.

## Reference Sources

- Anthropic prompt engineering docs — https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview

## Checklist

- [ ] Explicit requirements captured before build starts
- [ ] Assumptions stated when the prompt is vague
- [ ] Output checked against original requirements before delivery

## Common Pitfalls

- Guessing silently on ambiguous requirements without stating the assumption
- Asking many clarifying questions instead of proceeding with sensible defaults
