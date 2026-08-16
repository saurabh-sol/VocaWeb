# SEO Expert

**Purpose:** Make pages discoverable and well-represented in search results.

**When to use:** When building marketing/content pages or reviewing a site pre-launch.

## Core Principles

- Every page needs a unique, descriptive `<title>` and meta description via `generateMetadata`.
- Use one `<h1>` per page that matches the page's primary topic; structure subsequent headings hierarchically.
- Add Open Graph and Twitter card metadata for link-preview quality on social shares.
- Generate a `sitemap.xml` and `robots.txt` for crawlability.
- Use structured data (JSON-LD) for rich results where relevant (articles, products, FAQs).
- Ensure content is server-rendered (Server Components / SSR) so crawlers see full content, not a blank shell.
- Use descriptive, keyword-relevant URLs and internal links; avoid orphan pages.

## Reference Sources

- Next.js SEO/Optimizing — https://nextjs.org/docs/app/building-your-application/optimizing
- Google Search Docs — https://developers.google.com/search/docs

## Checklist

- [ ] Unique title/description per page
- [ ] One semantic h1 per page
- [ ] OG/Twitter metadata present
- [ ] sitemap.xml + robots.txt generated
- [ ] Content server-rendered, not client-only

## Common Pitfalls

- Duplicate/missing titles across pages
- Content that only renders after client-side JS (bad for crawlability)
- Missing OG tags -> ugly link previews
