# SmartSpaces Quote — Shopify Request-a-Quote app

Storefront-first Shopify app for high-end home automation dealers. Hides price and the buy button on quote-only products, lets shoppers build a "quote cart," and submits a request that becomes a **Shopify Draft Order**. The merchant then edits pricing and adds service line items (install, programming, design) in Shopify's native **Drafts admin** and clicks **Send invoice**. No custom admin UI beyond a single settings page; no app database; Shopify Flow handles all intake email.

Built for zero recurring SaaS: no Prisma, no Redis, no Resend, no BotID. Everything runs on Shopify-native primitives plus one small Next.js backend on Vercel.

---

## Architecture at a glance

```
Storefront (Liquid theme)
 ├─ product-quote-button block  → replaces price + buy button on quote-only PDPs
 ├─ quote-cart-drawer embed     → floating button + slide-over list
 └─ quote-cart-page block       → /pages/request-quote form

   ▼ POST /apps/quote/submit (HMAC-signed App Proxy)

Next.js server (Vercel)
 ├─ /api/proxy/submit   → verify HMAC → (opt) upload file to Shopify Files
 │                        → findOrCreateCustomer → draftOrderCreate
 │                          (tagged "quote-request", project metadata as custom attrs)
 ├─ /api/proxy/cart     → logged-in customer quote-cart sync via customer metafield
 ├─ /api/auth/*         → OAuth install/callback; defines metafields on install
 ├─ /api/webhooks/…     → app/uninstalled
 └─ /admin              → single settings page (bulk toggle quote-only, form config)

Shopify Flow (free) — triggered by Draft order created + tag "quote-request"
 ├─ Email the merchant
 └─ Email the customer
```

## Data model (all in Shopify)

| Where | Key | Purpose |
|---|---|---|
| Product metafield | `quote.quote_only` (boolean) | Marks non-purchasable SKUs |
| Customer metafield | `quote.cart` (json) | Persists quote cart for logged-in customers |
| Shop metafield | `quote.settings` (json) | Form-field toggles, merchant email |
| Draft Order (tag: `quote-request`) | — | **The quote itself.** Merchant edits in native admin. |
| Draft Order custom attributes | `phone`, `project_address`, `timeline`, `budget_range`, `floor_plan_file_id`, `source` | Project metadata snapshot |

---

## Repository layout

```
app/
  admin/               # Single settings page (server actions + client form)
  api/
    auth/[...shopify]/ # OAuth install + callback; creates metafield definitions
    proxy/submit/      # App Proxy POST: HMAC-verified quote submission
    proxy/cart/        # App Proxy GET/PUT: logged-in cart sync
    webhooks/
      app-uninstalled/
lib/
  quote.ts             # Zod schemas + constants
  hmac.ts              # App Proxy signature verification
  shopify.ts           # Admin GraphQL client (one shop / one token)
  customer.ts          # findOrCreateCustomer
  draftOrder.ts        # createDraftOrderFromQuote + 5-min dedupe
  files.ts             # Shopify Files staged upload + fileCreate
extensions/
  quote-storefront/    # Theme App Extension (Liquid blocks + vanilla JS)
flows/                 # Shopify Flow templates + README
docs/ or plans/        # Design docs and plans
```

---

## Stack

- **Next.js 16** App Router, React 19
- **Vercel** (Fluid Compute, Node 24)
- **Zod** for all payload validation
- **Theme App Extension** — Liquid + vanilla JS + CSS (no framework)
- **Session storage:** single env var (`SHOPIFY_OFFLINE_TOKEN`) for single-store custom install. No DB, no Redis.
- **Files:** Shopify Files API (no Vercel Blob, no S3)
- **Email:** Shopify Flow (no Resend, no SMTP)
- **Spam defense:** App Proxy HMAC + form honeypot + 5-min dedupe

**Recurring infra cost:** Vercel Hobby = $0 (use Pro $20/mo for commercial). No other SaaS. Everything else is either Shopify-native or built-in to Vercel.

---

## Current deployment

- **App name:** `smartspaces-quote` (Shopify Partners)
- **Client ID:** `4d779ee13019d49ad22bdd0647fcb625`
- **Production URL:** `https://smartspaces-quote.vercel.app`
- **App Proxy:** `/apps/quote/*` → `https://smartspaces-quote.vercel.app/api/proxy/*`
- **Dev store:** `smart-spaces-za.myshopify.com`
- **Partners app dashboard:** `https://dev.shopify.com/dashboard/213074664/apps/349507452929`

Active config file: `shopify.app.smartspaces-quote.toml` (a `shopify app deploy` pushes changes from here to Shopify).

---

## First-time setup (from scratch)

Prereqs: Node 20+, npm, Vercel CLI, Shopify CLI, a Shopify Partners account, a dev store.

```bash
git clone <repo>
cd smartspaces
npm install
```

### 1. Link to Shopify Partners

```bash
shopify app config link
```

Choose "Create this app as a new app." The CLI opens your browser, creates a Partners app entry, and writes `shopify.app.<name>.toml` with the `client_id`. Edit that file to point `application_url`, `auth.redirect_urls`, and `app_proxy.url` at your Vercel deployment (once you have one).

### 2. Deploy to Vercel

```bash
vercel link --yes --project smartspaces-quote
vercel deploy --prod --yes
```

Note the production URL. Update the Shopify toml if it differs from what you pre-set.

### 3. Set environment variables in Vercel

From the Partners dashboard → API credentials, copy **Client ID** and **Client secret**.

```bash
# Set each for the "production" environment (and any others you want):
printf "%s" "<client-id>"       | vercel env add SHOPIFY_API_KEY production --force
printf "%s" "<client-secret>"   | vercel env add SHOPIFY_API_SECRET production --force
printf "%s" "https://smartspaces-quote.vercel.app"                                       | vercel env add SHOPIFY_APP_URL production --force
printf "%s" "read_customers,read_draft_orders,read_products,write_customers,write_draft_orders,write_files,write_products" | vercel env add SHOPIFY_SCOPES production --force
printf "%s" "<your-store>.myshopify.com" | vercel env add SHOPIFY_SHOP_DOMAIN production --force
# One-time token capture toggle (see step 6):
printf "%s" "1" | vercel env add SHOPIFY_SHOW_TOKEN_ON_INSTALL production --force
```

Redeploy to pick up env vars:

```bash
vercel deploy --prod --yes
```

### 4. Push Shopify app config + theme extension

```bash
shopify app deploy
```

Confirm "yes" to release. This uploads the `quote-storefront` theme app extension and syncs `shopify.app.<name>.toml` (URLs, scopes, app proxy, webhooks) to Shopify.

### 5. Set distribution + generate install link

In Partners → Apps → smartspaces-quote → **Distribution** → choose **Custom distribution** → enter the dev store → **Generate install link**.

Paste that one-time link in your browser → **Install app**.

> Custom-distribution installs complete via Shopify's managed OAuth and drop you at `application_url`. This *doesn't* hit our `/api/auth/callback`, so no access token is captured yet. Run the classic OAuth flow next to get a token.

### 6. Capture the access token

Open this URL (replace the shop if different):

```
https://smartspaces-quote.vercel.app/api/auth/install?shop=smart-spaces-za.myshopify.com
```

Because the app is already installed, Shopify fast-forwards through consent and our callback fires. With `SHOPIFY_SHOW_TOKEN_ON_INSTALL=1` set, the callback returns an HTML page displaying the offline access token.

Copy the token, then:

```bash
printf "%s" "<offline-token>" | vercel env add SHOPIFY_OFFLINE_TOKEN production --force

# Disable token display:
vercel env rm SHOPIFY_SHOW_TOKEN_ON_INSTALL production --yes

vercel deploy --prod --yes
```

### 7. Configure the storefront

1. In the dev store's **theme editor** (Online Store → Themes → Customize):
   - **App embeds** → enable **Quote: Cart Drawer**.
   - **Product template** → add **Quote: Product CTA** to the main section.
2. Create a new page: **Online Store → Pages → Add page** with handle `request-quote`.
3. Edit the page in the theme editor → add **Quote: Request Page** block.
4. Mark at least one test product as quote-only: go to `https://smartspaces-quote.vercel.app/` (the admin settings) or directly set the `quote.quote_only` metafield on the product to `true`, and add the tag `quote-only`.

### 8. Install Shopify Flow + import workflow templates

1. Install the free **Shopify Flow** app on the dev store.
2. Create the two workflows described in `flows/README.md`:
   - "New quote request → notify merchant"
   - "New quote request → confirm to customer"

---

## End-to-end test

1. From the dev store storefront, open a quote-only product. Confirm price is hidden and "Request Quote" shows instead of "Add to Cart."
2. Click "Request Quote." Drawer opens with the item.
3. Click the CTA → lands on `/pages/request-quote`.
4. Fill the form (guest email), attach a floor plan, submit.
5. Check **Shopify Admin → Orders → Drafts → filter tag `quote-request`**. Your submission should appear with project metadata and the floor plan file ID in custom attributes.
6. Check **Shopify Flow → Run history** — both email workflows should have fired.
7. Open the draft. Edit line prices. Add a custom line item like "Installation — 8 hrs @ $150". Click **Send invoice**.
8. Check customer inbox — Shopify's native invoice email should be there. Pay via Bogus Gateway to confirm the draft → order conversion.

---

## Scripts

```bash
npm run dev         # Next dev server (not useful in Shopify context — use the deployed URL)
npm run build       # Next production build
npm run start       # Serve built app
npm run typecheck   # tsc --noEmit
npm test            # Vitest (hmac, quote schema, draftOrder mapping)
```

---

## Scopes

`read_customers, read_draft_orders, read_products, write_customers, write_draft_orders, write_files, write_products`

If scopes change, bump `shopify.app.<name>.toml` and run `shopify app deploy`, then reinstall the app to re-authorize.

---

## Deliberately omitted (YAGNI)

- Custom quote builder admin — Shopify's native Drafts admin is the builder.
- Metaobjects — tags + custom attributes on the Draft Order carry everything.
- Prisma / Neon / app DB — stateless.
- Vercel Queues, Workflow DevKit, AI layer — not needed Phase 1; additive later.
- Shopify Functions checkout gate — add if we see bypass in the wild.
- Customer Account UI Extensions (storefront quote history) — add if merchants ask.

---

## License

Private.
