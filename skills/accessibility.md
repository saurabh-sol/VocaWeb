# Accessibility

**Purpose:** Ensure the site is usable by people relying on assistive technology.

**When to use:** On every UI build — accessibility is not optional, review it by default.

## Core Principles

- Use semantic HTML first (`button`, `nav`, `header`, `main`) before reaching for ARIA roles.
- Every interactive element must be reachable and operable via keyboard alone (Tab, Enter, Space, Esc).
- Maintain a minimum 4.5:1 contrast ratio for body text, 3:1 for large text.
- Images need meaningful `alt` text; decorative images get `alt=""`.
- Forms need associated `<label>`s, clear error messaging, and logical tab order.
- Visible focus states must never be removed (`outline: none` without a replacement is a violation).
- Test with screen reader basics in mind: content order should make sense when read linearly.

## Reference Sources

- W3C WAI — https://www.w3.org/WAI/
- web.dev Accessibility — https://web.dev/accessibility/

## Checklist

- [ ] Semantic HTML used over div soup
- [ ] Full keyboard navigability
- [ ] Contrast ratios meet WCAG AA
- [ ] Focus states visible
- [ ] Forms properly labeled

## Common Pitfalls

- Removing focus outlines without replacement
- Icon-only buttons with no accessible label
- Color as the only signal for state (e.g. red text with no icon/label for errors)
