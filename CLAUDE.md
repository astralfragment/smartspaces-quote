# CLAUDE.md — Working notes for Claude Code

This file is guidance for Claude Code (and any AI assistant) when working in this repo. Read it before making changes.

---

## What this project is

A Shopify **Request-a-Quote** app for a high-end home automation dealer (Control4 / Crestron / Savant tier). Many SKUs are MAP-restricted or dealer-only and cannot show public pricing. The app replaces price + buy button with "Request Quote" on those products, lets shoppers build a quote cart, and writes a tagged **Draft Order** that the merchant edits in Shopify's native Drafts admin.

See `README.md` for architecture, setup, and end-to-end test. See `docs/` or `plans/` for the design history.

---

## Guardrails — please follow

1. **Do not add app-local persistence.** No Prisma, no Redis, no SQLite, no Neon, no Vercel KV. All state lives in Shopify (metafields, metaobjects, draft order tags + custom attributes) plus `SHOPIFY_OFFLINE_TOKEN` as a Vercel env var for the single-store custom install. If a feature seems to need a DB, push back and reconsider.
2. **Do not add paid SaaS.** No Resend, no Upstash, no Vercel Blob, no Vercel BotID, no Sentry, etc. Free-tier primitives only. Shopify Flow handles email; Shopify Files handles uploads; HMAC + honeypot handles spam.
3. **Do not add any custom admin UI.** Shopify's native admin handles everything: product-level `quote.quote_only` metafield (pinned) for marking SKUs, Drafts page for quote building, Shopify Flow for intake email. The app's `/` page is an informational landing for the embedded iframe and nothing more. If someone asks for a quote dashboard, push back — the answer is "it's at /admin/orders?tag=quote-request".
4. **Do not install Polaris or App Bridge.** They pull peer-dep conflicts with React 19 and are not needed. The settings page uses plain styled divs.
5. **Do not invent new metaobjects.** The quote *is* a Draft Order. Don't mirror it to a metaobject.
6. **Do not change the storefront tech.** The storefront is a Liquid theme app extension (blocks + vanilla JS). No React in the extension.
7. **Keep schemas in `lib/quote.ts` as the single source of truth.** All API routes validate input with Zod against those schemas.
8. **Don't generate comments that describe what the code does.** Only write a comment if it captures a non-obvious *why*.
9. **Don't write unit tests for trivial code.** Tests exist for `hmac.ts`, `quote.ts` (schema), and `draftOrder.ts` (payload shaping). Add tests for new `lib/` logic with real business rules. Don't mock-test route handlers — end-to-end via the dev store is the contract.

---

## Current state of the deployment

- App: `smartspaces-quote` (Partners org `213074664`, app `349507452929`)
- Client ID: `4d779ee13019d49ad22bdd0647fcb625`
- Production URL: `https://smartspaces-quote.vercel.app`
- Dev store: `smart-spaces-za.myshopify.com`
- Active config file: `shopify.app.smartspaces-quote.toml`
- App proxy: `/apps/quote/*` → `/api/proxy/*`

Env vars set in Vercel (production):
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SHOPIFY_SCOPES`
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_OFFLINE_TOKEN` — **to be captured on next install; see README step 6**
- `SHOPIFY_SHOW_TOKEN_ON_INSTALL` — set to `1` only while capturing the token; **remove after** to avoid exposing tokens on re-install

---

## How to deploy

- **Backend / Next.js:** `vercel deploy --prod --yes`. Vercel tracks each deploy in the dashboard.
- **Shopify config + theme extension:** `shopify app deploy`. Creates a new app version in Partners; confirm to release.
- Commit to git before each deploy so the Vercel dashboard and git history stay aligned.

---

## How to run tests

```bash
npm test           # Vitest — unit tests for lib/
npm run typecheck  # tsc --noEmit
```

End-to-end testing requires the dev store — follow the E2E steps in the README.

---

## Known decisions worth remembering

- **Custom distribution** is the Partners distribution mode. It's a one-time install link per store. The first install completes via Shopify's managed OAuth and lands on `application_url` (skipping our callback). To capture an offline access token, we run our `/api/auth/install?shop=…` URL a second time — Shopify fast-forwards through consent and our `/api/auth/callback` fires.
- **Token capture** is currently done via `SHOPIFY_SHOW_TOKEN_ON_INSTALL=1`, which renders the token in an HTML page on the callback. This is a one-time flag — unset + redeploy after capturing.
- **Dedupe window** for quote submissions is 5 minutes, keyed by (customer email, `quote-request` tag, status=open). Two submissions within that window append to the same Draft Order rather than creating a second one. See `findRecentDuplicateDraft` in `lib/draftOrder.ts`.
- **Storefront cart** is Shopify's native cart — no custom quote cart, no localStorage. Quote-only products are flagged by tag/metafield and are hidden from checkout on the cart page; the request-quote form reads the current cart via `/cart.js`, submits the quote-only subset, then removes those lines via `/cart/change.js` on success.
- **Collection card price hiding** relies on products *also* having a `quote-only` tag (applied by the admin settings page's bulk toggle alongside the `quote.quote_only` metafield). The tag is the storefront-queryable signal; the metafield is the authoritative source.

---

## Common next asks and how to handle them

- **"Add service line items to the quote"** → no code change. Merchant adds them as custom line items in the native Draft Order editor. If the merchant wants templated "Install hour", "Programming hour", etc., consider a Shopify Flow that auto-adds them, or a Service Items section on the admin settings page that lets the merchant define named service rates.
- **"Add rooms / zones to the quote"** → start with a free-text "Rooms" field in the form (already in `notes`). If demand is real, add a structured `rooms` array to the submission schema and stuff it into a Draft Order custom attribute.
- **"Allow customer to see quote status"** → add a Customer Account UI extension at `/account/quotes` that lists Draft Orders filtered by `email:<customer.email>` and `tag:quote-request`.
- **"Send a PDF proposal"** → add a server action that server-renders a PDF from a Draft Order + custom attributes using `@react-pdf/renderer`. Store result in Shopify Files; attach URL to a custom attribute or email.
- **"Multiple stores / public distribution"** → the single-env-var session model breaks. You'd need a session store (Upstash Redis is the smallest addition) and per-shop token lookup. That's a bigger refactor — weigh carefully.

---

## Files I actively touch vs. files I leave alone

| Edit often | Leave alone unless necessary |
|---|---|
| `lib/*.ts` | `shopify.app.smartspaces-quote.toml` (CLI-managed) |
| `app/api/*` | `extensions/quote-storefront/shopify.extension.toml` (CLI-managed `uid`) |
| `app/page.tsx` (info page) | `.vercel/project.json` (Vercel-managed) |
| `extensions/quote-storefront/blocks/*.liquid` | `next.config.ts` unless security headers change |
| `extensions/quote-storefront/assets/*` | |

---

## Style

- Short files. One responsibility per file.
- Zod validates at boundaries; TypeScript everywhere else.
- No error swallowing. If Shopify returns `userErrors`, throw with the JSON so it shows up in Vercel logs.
- No clever abstractions for hypothetical second stores — this is a single-store app.
- No comments narrating what the code does. Only *why* if non-obvious.
