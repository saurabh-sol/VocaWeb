# Debugging

**Purpose:** Systematically find and fix bugs in the running application.

**When to use:** When something is broken, behaving unexpectedly, or throwing errors.

## Core Principles

- Reproduce the bug reliably before attempting a fix — don't guess-patch.
- Read the actual error/stack trace fully before hypothesizing; the real cause is often in the first few lines.
- Use Chrome DevTools (Network, Console, Elements, Performance tabs) to inspect real runtime state.
- Use React DevTools to inspect component props/state/render causes for UI bugs.
- Bisect: comment out / isolate halves of the suspect code to narrow down the failure point.
- Fix the root cause, not just the symptom — check if the same bug class exists elsewhere in the codebase.

## Reference Sources

- Chrome DevTools — https://developer.chrome.com/docs/devtools/
- React DevTools — https://react.dev/learn/react-developer-tools

## Checklist

- [ ] Bug reproduced reliably
- [ ] Root cause identified (not just symptom patched)
- [ ] Checked for the same bug pattern elsewhere
- [ ] Fix verified against the original repro steps

## Common Pitfalls

- Patching symptoms without understanding root cause
- Ignoring the full stack trace
- Fixing one instance while identical bugs remain elsewhere
