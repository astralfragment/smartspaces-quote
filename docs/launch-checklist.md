# Launch Checklist — SmartSpaces Quote

Manual actions the merchant (or whoever owns the dev store) must complete before pointing real traffic at the app. These happen in Shopify Admin / Vercel / Shopify Partners and can't be automated from code.

## Stop-ship gates (must be ticked before launch)

- [ ] **Turn off storefront password.** `Shopify Admin → Online Store → Preferences → Password protection → Disable password`. While enabled, only people with the password can see the storefront — real customers can't reach the request-a-quote flow.

- [ ] **Ship and enable the cart-validation Shopify Function** — covers the `/cart/<variant>:<qty>?replace` permalink bypass described in [docs/review/STATUS.md §3 stop-ship #3](review/STATUS.md). Until this is enabled, a quote-only item added via that URL reaches checkout at its (empty) retail price. The implementation plan is in [docs/superpowers/plans/2026-04-19-finish-quote-app-stopship.md — Task 3](superpowers/plans/2026-04-19-finish-quote-app-stopship.md) and requires an interactive `shopify app generate extension` scaffold plus a manual enable step. Merchant enable path: `Settings → Checkout → Checkout rules → Add validation → Smartspaces Quote → Quote cart validation`. **Hard blocker:** if that section is not visible in the admin, the store is on a plan that doesn't include checkout validation — the bypass cannot be closed without a plan upgrade.

- [ ] **Unset `SHOPIFY_SHOW_TOKEN_ON_INSTALL` in Vercel.** `Vercel → Project → Settings → Environment Variables`. Per [CLAUDE.md "Known decisions"](../CLAUDE.md), this flag should only be `1` during the one-time offline token capture; leaving it on exposes the token on every re-install.

- [ ] **Verify the submit-route rate limit is active in production.** After the next deploy, run:
  ```bash
  for i in 1 2 3 4 5 6; do
    curl -sS -o /dev/null -w "%{http_code}\n" \
      -XPOST -H "content-type: application/json" -d '{}' \
      https://smartspaces-quote.vercel.app/apps/quote/submit
  done
  ```
  Expected: the first 5 return `401` (bad HMAC — expected; the limiter runs before HMAC verification so spam can't burn cycles), the 6th returns `429` with a `Retry-After` header. The limiter is in-memory per Vercel serverless instance, so this is best-effort — sufficient for single-store traffic profile.

## What's shipped in code

These are the **three** stop-ship items that landed in the session of `2026-04-19`. Items 1–2 are in commit `ebf94ae`; item 3 is in the commit that introduced this file.

| STATUS.md item | Status | Where |
|---|---|---|
| #1 Cart section not rendering | ✅ shipped | `public/storefront.js` — `findCartAnchor` + `MutationObserver` |
| #2 Cart-line price leak | ✅ shipped | `public/storefront.js` + `public/storefront.css` — `markQuoteLines` + scoped CSS hide |
| #3 Permalink bypass (Shopify Function) | ⏳ deferred | See companion plan + merchant enable step above |
| #4 Launch hygiene (password off + rate limit) | ✅ partial | Rate limit in `lib/rateLimit.ts` + `app/api/proxy/submit/route.ts`; password off = merchant action above |

## Deferred (not stop-ship)

Tracked in [`docs/review/STATUS.md`](review/STATUS.md) high/medium/low/a11y sections. NOT required for a safe launch, only for a polished one.

- Shopify Flow workflows for customer + merchant email (per `flows/README.md`)
- PDP button icon + "Price on request" copy
- Cart-section CTA visual distinction from native Checkout
- Accessibility pass on form labels + honeypot semantics
- Request-quote page styling polish
