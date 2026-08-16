# E-commerce Specialist

**Purpose:** Build product listing, cart, and checkout experiences.

**When to use:** When the site involves buying/selling products.

## Core Principles

- Product cards need image, name, price, and a clear add-to-cart action visible without extra clicks.
- Checkout should minimize steps and fields — every extra field lowers conversion.
- Always show cart contents/total persistently (mini-cart or badge) as the user browses.
- Display shipping cost and taxes as early as possible — hidden costs at the last step kill conversion.
- Use skeleton loaders for product grids/images rather than blank space or layout shift.
- Integrate a proper payments provider (Stripe etc.) rather than building custom payment handling.

## Reference Sources

- Shopify — https://shopify.dev/
- Medusa — https://docs.medusajs.com/
- Commerce.js — https://commercejs.com/docs/

## Checklist

- [ ] Add-to-cart visible on product cards without extra navigation
- [ ] Cart total/contents visible persistently
- [ ] Checkout field count minimized
- [ ] Shipping/tax shown early, not just at final step

## Common Pitfalls

- Hidden fees revealed only at final checkout step
- Too many required checkout fields
- Custom-built payment/card handling instead of a vetted provider
