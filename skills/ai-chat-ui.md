# AI Chat UI

**Purpose:** Design UI patterns for conversational/AI chat interfaces.

**When to use:** When building a chat-based interaction into the product.

## Core Principles

- Stream responses token-by-token when possible rather than showing a long blocking spinner.
- Show a clear typing/thinking indicator distinct from a generic loading spinner.
- Preserve and clearly delineate conversation turns (user vs assistant) with consistent styling.
- Provide easy access to stop/regenerate a response, and to copy assistant output.
- Handle errors gracefully inline in the conversation, not with a disruptive modal/alert.

## Reference Sources

- General conversational UI pattern references (ChatGPT, Claude.ai interfaces as structural study)

## Checklist

- [ ] Responses stream rather than block on a spinner
- [ ] Clear typing/thinking indicator
- [ ] Stop/regenerate/copy actions available on responses

## Common Pitfalls

- Long blocking spinner with no streaming feedback
- Errors shown as disruptive modals instead of inline messages
