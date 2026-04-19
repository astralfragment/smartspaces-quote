# SmartSpaces Quote — End-to-End Status & Review

**As of deployment `f6b5355` / `4abc121` on Vercel + Shopify extension v6.**

## 1. What is verified working (screenshots captured)

### ✅ Quote-only product page (`B+W 805 D4 Signature Bookshelf`)
- Price completely hidden (R 299,990.00 is gone).
- Primary CTA reads **"Add to Quote"** instead of "Add to cart."
- Shopify's "Buy it now" dynamic checkout button is hidden (MAP-safe — no price leak via checkout).
- Screenshot: captured on Vercel deploy `f6b5355`.

### ✅ Regular product page (`B+W PX7 S2 Headphones`)
- Price shown normally: R 4,999.00 ZAR (with strikethrough R 5,999.00 sale).
- Primary CTA reads **"Add to cart"** (normal).
- No interference from our app on non-quote products.

### ✅ Adding a quote-only item to the native cart
- The B+W 805 D4 successfully enters the native Shopify cart via the relabeled "Add to Quote" button (tested with cart-permalink fallback too).
- Cart bubble counter updates to "1" in the header.
- Native cart page shows the item with quantity, image, price line — no broken states.

### ✅ Embedded admin inside Shopify Admin iframe
- Route: `https://admin.shopify.com/store/smart-spaces-za/apps/smartspaces-quote`.
- App Bridge loads (from CDN, script tag in nested admin layout).
- **Session-token-gated**: every read/write uses a 1-minute JWT fetched from App Bridge and verified server-side (`lib/sessionToken.ts`, HS256 per Shopify spec).
- Saves settings to shop metafield `quote.settings`; round-trip verified (green "Settings saved." confirmation captured previously).
- Opening `/admin` directly in a browser outside the iframe SSR-redirects to the Shopify admin app page.

### ✅ Backend schema + unit tests
- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 21/21 green (hmac, session token, quote schema, draft order payload shaping).

### ✅ Source control & deployment
- GitHub: https://github.com/astralfragment/smartspaces-quote (public, all history).
- Vercel: https://smartspaces-quote.vercel.app (production; `vercel deploy --prod --yes` pipelines cleanly).
- Shopify Partners: app version 6 pushed via `shopify app deploy --force`.
- Scopes: `read_customers, read_draft_orders, read_products, read_themes, write_content, write_customers, write_draft_orders, write_files, write_products, write_themes`.

## 2. What is in-flight (code shipped, last-mile behavior not yet captured on screen)

### ⚠️ Cart page "Quote required" section
- Code is live in `public/storefront.js` (tag-filter fix committed in `4abc121`).
- `<script src="…/storefront.js">` is confirmed present on all storefront pages via theme.liquid injection.
- On this specific custom theme, the section isn't yet rendering above the native cart. Likely last-mile fix: the insertion selector (`main#MainContent`) needs a more specific anchor OR the script ran before theme hydration moved things around. The fix is mechanical (~10 lines) but ran out of session budget.

### ⚠️ Request-quote page form
- `/pages/request-quote` is created in Shopify (tested via API).
- `storefront.js` mounts a full form on that page (summary + contact fields + file upload + honeypot), wires the submit to `/apps/quote/submit`, then `/cart/change.js` qty=0 per line to clear quoted items.
- Not yet verified end-to-end because the cart-section issue blocks the happy path.

### ⚠️ Draft Order creation from the submitted form
- Backend path is covered by unit tests and the schema zod-validates.
- Live submission wasn't exercised in this session.

### ⚠️ Mixed-cart checkout intercept (non-quote Checkout)
- Logic is in `storefront.js`: when the cart has both kinds, click on checkout selectors triggers `/cart/change.js` qty=0 for quote-only lines, then `window.location = "/checkout"`.
- Gated on the same injection code path that's not yet rendering visibly.

## 3. UX / UI critical review for release

### Stop-ship (must-fix before real use)
1. **Cart-page integration isn't rendering** — the whole "quote + purchase together" flow depends on the "Quote required" section showing. Until this is visible, merchants can't see the split and customers can't self-serve the quote flow from the cart. Cause is likely a theme-specific selector miss; low effort once diagnosed in DevTools.
2. **Cart-line price leak** — on the cart page, the quote-only item still shows its price (R 299,990.00). That defeats the MAP protection the PDP provides. Add a line-level CSS hide using the emitted `data-qr-line-id` attribute per quote-only line.
3. **Permalink bypass** — the `/cart/<variant>:<qty>?replace` URL adds to cart and redirects straight to Shopify checkout, skipping the cart page and our intercept. A quote-only item entered that way gets purchased at its (empty) retail price. Fixing needs a **Shopify Function** (cart validation) that blocks checkout if any line has the quote-only tag. That's the only defense-in-depth; storefront JS can't close it alone.
4. **Storefront password is still on** — this is a dev store. For release it needs to come off, and BotID or hCaptcha should be enabled on the request-quote submit path (we have honeypot + HMAC; for public storefronts, add challenge).

### High (ship but fix fast)
5. **"Add to Quote" button visually identical to "Add to cart"** — same styling, same icon, same height. Consider swapping the cart icon for a document icon (Heroicons `document-text`) or removing the icon on quote-only products so the semantic shift is visually obvious.
6. **No price-on-request copy** — the PDP just shows an empty gap where the price was. For MAP-restricted luxury gear, shoppers expect a "Price on request" or "Contact for pricing" label instead of nothing. That builds trust and clarifies the flow.
7. **Quote requested product's cart entry still says "R 299,990.00"** — same as stop-ship #2 but also needs a "Quote required" badge visually on the cart line, not just the side section.
8. **No confirmation step before leaving the request-quote form** — submit button is one click. For a request that the merchant will act on in business hours, a confirmation like "Send request to <store email>?" would reduce accidents.
9. **File upload has no progress / size feedback** — 10 MB limit is enforced server-side; in the UI it's silent. Add a progress indicator and a visible size/type hint below the input.

### Medium (nice-to-have, not release-blocking)
10. **Request Quote page header is very plain** — "Request a Quote" H1 + one-line intro on a white background. For a luxury brand this should feel bespoke. Suggest: dark theme to match the site, subtle divider, maybe a single brand image.
11. **Admin settings page is plain HTML** — intentional (Polaris conflicts with React 19) but it sticks out in Shopify Admin. A thin layer of Polaris-like spacing/typography would make it feel native. Acceptable for v1; revisit when React 19 / Polaris compat ships.
12. **No empty-state education on the request-quote page** — if a customer lands on `/pages/request-quote` with an empty cart, we show "Your quote is empty — browse the shop to add items." That's fine but a single inline "Browse collections" CTA button would help.
13. **Cart-section CTA button and native Checkout button should visually differ** — when both appear in mixed mode they both look like primary dark buttons. Suggest: quote CTA uses an accent color (e.g. the cream-amber of the "Quote required" frame), native Checkout stays brand-primary.
14. **No visible currency / region cue** on the request-quote summary — shoppers from South Africa see prices in ZAR elsewhere but the form never echoes currency. Add it to the per-line qty row.
15. **Storefront.js loads unconditionally on every page** — ~16KB served to every request even on static pages (About Us, Projects). That's fine but the script could short-circuit sooner when no work applies (cart = empty, PDP = not quote-only).

### Low (hygiene / future)
16. **No Shopify Flow workflow installed** — the `flows/README.md` describes the two email workflows but they need manual creation. Do this before launch; without them, customers get no confirmation email and the merchant has no notification except "new draft" in admin.
17. **`quote.settings` shop metafield is private** — only readable via admin API. For the storefront to read config via Liquid someday, grant storefront `PUBLIC_READ` (we already do this for `quote.quote_only` product metafield).
18. **`/api/auth/install` still exposes its browser redirect dance publicly** — no rate limit on Vercel side. Low risk (fails harmlessly without a valid OAuth code) but worth adding a simple 5/min IP bucket.
19. **Error messages on submit failure show raw backend error codes** — e.g. `validation_failed`. Translate to human copy in `storefront.js`.
20. **Admin "Loading…" spinner is text-only** — no visual indicator. Swap for a small CSS spinner or skeleton.

### Accessibility
21. **Button relabel may lose aria-label** — if the theme's button has `aria-label="Add to cart"`, our text swap doesn't touch aria. Screen readers will still announce "Add to cart." Add aria-label update in the relabel loop.
22. **Form labels are present but not always `for=`-associated** — the form rendered by JS uses `<label><span>…</span><input></label>` wrapping; that's accessible but brittle if themes style `<label>` unusually. Consider explicit `for=` + `id=`.
23. **Honeypot field uses `visibility:hidden`-style offscreen technique — some assistive tech still announces it**. Use `aria-hidden="true" tabindex="-1"` (we do) but also add `autocomplete="off" role="presentation"` for belt-and-suspenders.

## 4. Concrete next actions (by priority)

1. **Fix the cart-page injection** (Stop-ship #1). Open the cart page in the merchant's browser, run our JS inline in DevTools, see what `document.querySelector("main")` returns and why `insertBefore` doesn't paint. Likely fix: insert at a more specific anchor like `#MainContent > section:last-child` OR use `MutationObserver` to wait for theme hydration.
2. **Hide price on cart lines for quote-only items** (Stop-ship #2) — add a CSS rule scoped to `[data-qr-line-id]` and a data attribute, or a per-line marker emitted by our JS after `/cart.js` fetch.
3. **Ship a Shopify Function that blocks quote-only variants at checkout** (Stop-ship #3). That's a separate extension type (`checkout.cart.validation.v1`); small amount of Rust/JS. I have not built this yet — a ~half-day addition.
4. **Replace button icon + add "Price on request" copy** on quote-only PDP (High #5, #6).
5. **Walk through the request-quote form** end-to-end in production (High; the code is in place but unverified live). Produce screenshots 05–10 after the cart page renders correctly.
6. **Set up the two Shopify Flow workflows** per `flows/README.md`.
7. **Turn off storefront password before real launch** + add BotID/hCaptcha on `/apps/quote/submit`.

## 5. Git / deploy artifacts for audit

- Repo: https://github.com/astralfragment/smartspaces-quote
- Production: https://smartspaces-quote.vercel.app
- App admin URL: https://admin.shopify.com/store/smart-spaces-za/apps/smartspaces-quote
- Shopify Partners app version: 6 (`https://dev.shopify.com/dashboard/213074664/apps/349507452929/versions/930568470529`)
- Key commits:
  - `4abc121` — fix: read product tags from cart.js item.product_tags
  - `f6b5355` — fix: hide Buy it now on quote-only PDPs
  - `e1c36dc` — feat: ship self-contained /storefront.js via theme.liquid
  - `b75589b` — refactor: convert blocks to app embeds (retained for reference)
  - `ad452f6` — feat: add theme scopes; restore one-time token capture
  - `1fa5db0` — refactor(v5): use native Shopify cart; split checkout & quote flows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
