# Payments

**Purpose:** Integrate payment/subscription flows correctly and safely.

**When to use:** When the app needs to charge users or manage subscriptions.

## Core Principles

- Use Stripe (or an equivalent PCI-compliant provider) — never handle raw card numbers directly on your own servers.
- Use Stripe Checkout/Elements for the payment UI so card data never touches your backend.
- Handle subscription state changes via webhooks (not just the initial client-side success callback) to stay in sync.
- Show clear pricing, billing cycle, and cancellation terms before the user commits to payment.
- Test with the provider's test-mode keys/cards before ever going live.

## Reference Sources

- Stripe Docs — https://stripe.com/docs

## Checklist

- [ ] PCI-compliant provider used, no raw card data touching own backend
- [ ] Webhooks used to keep subscription state in sync
- [ ] Pricing/cancellation terms clear before checkout

## Common Pitfalls

- Handling raw card numbers directly
- Relying only on the client-side success redirect to mark a subscription active (miss webhooks)
