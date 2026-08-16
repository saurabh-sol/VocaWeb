# Crypto/Web3 UI

**Purpose:** Design UI patterns specific to crypto/web3 products.

**When to use:** When building wallet connect, transaction, or token-related interfaces.

## Core Principles

- Always show pending/confirming/confirmed transaction states explicitly — blockchain transactions are not instant.
- Truncate wallet addresses (e.g. 0x1234...abcd) with a copy-to-clipboard action, never show the full string as primary UI.
- Show gas/network fee estimates before the user confirms any transaction.
- Clearly indicate which network/chain the user is connected to at all times.
- Never auto-trigger a wallet transaction without an explicit user-initiated action and confirmation.

## Reference Sources

- General web3 UX pattern references (Uniswap, OpenSea interfaces as structural study)

## Checklist

- [ ] Transaction status states shown explicitly
- [ ] Addresses truncated with copy action
- [ ] Network/chain indicator always visible
- [ ] Fees shown before confirmation

## Common Pitfalls

- Silent/instant-looking transactions with no pending state
- Full raw addresses as primary UI text
- Auto-triggered transactions without explicit confirmation
