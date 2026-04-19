# Finish SmartSpaces Quote App — Stop-Ship Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four stop-ship items in [`docs/review/STATUS.md`](../review/STATUS.md) so a real merchant can use the app safely. No polish beyond stop-ship.

**Architecture:** Three of the four items are last-mile fixes to the existing storefront JS and CSS (no new systems). The fourth — permalink bypass — requires a new Shopify **cart-checkout-validation Function** extension that runs server-side at Shopify's edge and blocks quote-only variants from reaching checkout regardless of how they entered the cart.

**Tech Stack:** Next.js 16 + React 19 on Vercel, vanilla JS storefront (`public/storefront.js`), Shopify Theme App Extension (Liquid blocks), Shopify Functions (JavaScript runtime, WASM-compiled), Shopify Admin GraphQL, Vitest for unit tests.

**Repo guardrails (see [CLAUDE.md](../../CLAUDE.md)):** No app DB. No paid SaaS. No Polaris. Zod at boundaries. Unit tests for `lib/` only; route handlers tested via dev store. Shopify Flow (free) handles notifications — not in scope here.

---

## Scope

Only the four stop-ship items from [STATUS.md §3](../review/STATUS.md):

1. **Cart-page "Quote required" section doesn't render** on the merchant's theme.
2. **Cart-line price leak** — quote-only items still show price on the native cart page.
3. **Permalink bypass** — `/cart/<variant>:<qty>?replace` sends quote-only items straight to checkout.
4. **Launch hygiene** — storefront password off + rate limit on `/apps/quote/submit`.

Everything else in STATUS.md (high/medium/low/a11y, Flow install) is deferred.

**Where this runs:** `C:\Users\char\smartspaces` (Next.js + Shopify app). Dev store: `smart-spaces-za.myshopify.com`. Local preview: `shopify app dev` proxies through Cloudflare.

---

## File Structure

**Touched / created:**

```
C:\Users\char\smartspaces\
├─ public\
│   ├─ storefront.js          # MODIFY — robust cart insertion (Task 1), mark native cart lines (Task 2)
│   └─ storefront.css         # MODIFY — hide price on flagged native cart lines (Task 2)
├─ extensions\
│   └─ quote-cart-validation\ # NEW — Shopify Function (Task 3)
│       ├─ shopify.extension.toml
│       ├─ src\
│       │   ├─ index.js       # the function entrypoint
│       │   └─ index.test.js  # vitest unit tests
│       └─ input.graphql      # Function input query
├─ app\api\proxy\submit\
│   └─ route.ts               # MODIFY — add rate limiter (Task 4)
├─ lib\
│   └─ rateLimit.ts           # NEW — in-memory per-IP token bucket (Task 4)
├─ docs\
│   └─ launch-checklist.md    # NEW — merchant actions incl. turn off storefront password (Task 4)
└─ shopify.app.smartspaces-quote.toml  # MODIFY — register the new function extension (Task 3)
```

**One responsibility per file.** `storefront.js` stays the single injected script; the function lives in its own extension; rate-limit logic is a one-file `lib/` module consistent with existing `lib/hmac.ts`, `lib/quote.ts` shape.

---

## Task 1: Cart-page section reliably renders

**Why:** [STATUS.md #1](../review/STATUS.md). The section is coded but not visible — the insertion selector in [`public/storefront.js:186-191`](../../public/storefront.js) misses on this theme, or the script fires before theme hydration moves the cart markup.

**Files:**
- Modify: `public/storefront.js:149-220` (the `renderCartSection` function)

### Background the engineer needs

The current selector chain is:
```js
var cartRoot = document.querySelector("form[action*='/cart']")
  || document.querySelector(".cart")
  || document.querySelector("main");
```
On the Horizon-based `smart-spaces-za` theme, the cart form isn't a direct child of a predictable anchor, and some themes render the cart via a web component (`<cart-items>`, `<cart-drawer-items>`) that mounts asynchronously.

**Fix approach:** broaden the selector list AND retry via `MutationObserver` so we handle themes that hydrate after `DOMContentLoaded`. Give up after 3 seconds to avoid running forever on pages that don't have a cart container.

- [ ] **Step 1: Read the current `renderCartSection` in full** — open [`public/storefront.js`](../../public/storefront.js) lines 149–220 so the next steps diff cleanly.

- [ ] **Step 2: Add a helper that resolves the cart anchor with retry**

Insert above the existing `renderCartSection` (before line 149):

```js
  function findCartAnchor() {
    var selectors = [
      "cart-items",                       // Dawn / Horizon web component
      "cart-drawer-items",
      "form[action='/cart']",
      "form[action*='/cart']",
      "main [data-section-type='cart']",
      "#MainContent form",
      "#MainContent",
      "main"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var n = document.querySelector(selectors[i]);
      if (n) return n;
    }
    return null;
  }

  function whenCartAnchorReady(callback) {
    var anchor = findCartAnchor();
    if (anchor) return callback(anchor);
    var observer = new MutationObserver(function () {
      var a = findCartAnchor();
      if (a) { observer.disconnect(); clearTimeout(timer); callback(a); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    var timer = setTimeout(function () {
      observer.disconnect();
      var a = findCartAnchor();
      callback(a);  // may be null; caller handles
    }, 3000);
  }
```

- [ ] **Step 3: Rewrite the insertion block in `renderCartSection`**

Replace lines 185–191 (the `// Insert before the main cart form, or append to main` block) with:

```js
    whenCartAnchorReady(function (cartRoot) {
      if (cartRoot && cartRoot.parentNode && cartRoot.tagName !== "MAIN") {
        cartRoot.parentNode.insertBefore(section, cartRoot);
      } else {
        (document.querySelector("main") || document.body).prepend(section);
      }
    });
```

The `tagName !== "MAIN"` guard ensures that if the only match we found is `<main>`, we `prepend` into it rather than try to insert a sibling — otherwise we'd place the section OUTSIDE the theme's content wrapper.

- [ ] **Step 4: Start the Shopify dev server and open the cart page**

```bash
cd C:/Users/char/smartspaces
npm run shopify
```
Wait for the dev tunnel URL to print, then open `https://<store>.myshopify.com/cart?preview_theme_id=<current>` in a browser with the B+W 805 D4 Signature Bookshelf already in cart. Expected: the cream/amber "Quote required" section renders above the native cart.

- [ ] **Step 5: Verify on an empty cart** — navigate to `/cart` with nothing added. Expected: no `.qr-cart-section` in DOM (no flash of empty state).

- [ ] **Step 6: Verify on a mixed cart** — add the B+W 805 D4 (quote-only) AND a non-quote item (e.g. B+W PX7 S2). Reload `/cart`. Expected: the Quote required section lists only the 805 D4; native cart still shows both. Checkout button click removes 805 D4 and navigates to `/checkout` (existing behavior at lines 207–218).

- [ ] **Step 7: Commit**

```bash
git add public/storefront.js
git commit -m "fix(storefront): cart section renders reliably via MutationObserver

Broadens the anchor selector list to cover <cart-items>,
<cart-drawer-items>, and theme-specific forms, then retries via
MutationObserver for up to 3s so themes that hydrate the cart after
DOMContentLoaded still get the insertion. Fixes STATUS.md stop-ship #1."
```

---

## Task 2: Cart-line price leak

**Why:** [STATUS.md #2](../review/STATUS.md). Even with Task 1 fixed, the NATIVE cart's line for the B+W 805 D4 still displays its R 299,990.00 price — leaking MAP pricing. The PDP hides price correctly; the cart line doesn't.

**Strategy:** after our JS knows which cart `key`s are quote-only (it already computes `quoteItems` at [`storefront.js:152`](../../public/storefront.js)), mark those lines in the theme's DOM with `data-qr-quote-only="true"` and apply a single CSS rule that hides price, subtotal, and remove-buttons scoped to those lines. Fall back to hiding via class if we can't find a `data-key` attribute on the theme's line.

**Files:**
- Modify: `public/storefront.js` (mark lines)
- Modify: `public/storefront.css` (hide prices on marked lines)

### Steps

- [ ] **Step 1: Add a `markQuoteLines` helper in `storefront.js`**

Insert after the `renderCartSection` function (after line 220):

```js
  function markQuoteLines(quoteItems) {
    var keys = quoteItems.map(function (i) { return String(i.key); });
    if (keys.length === 0) return;
    var candidates = document.querySelectorAll(
      "[data-cart-item-key], [data-key], [data-line-key], " +
      "tr[data-variant-id], li[data-variant-id], " +
      ".cart-item, .cart__row"
    );
    candidates.forEach(function (node) {
      var key = node.getAttribute("data-cart-item-key")
        || node.getAttribute("data-key")
        || node.getAttribute("data-line-key");
      if (key && keys.indexOf(String(key)) !== -1) {
        node.setAttribute("data-qr-quote-only", "true");
      }
    });
  }
```

- [ ] **Step 2: Call `markQuoteLines` from `renderCartSection`**

At line 160 (right after the `if (quoteItems.length === 0) return;`), add:

```js
    markQuoteLines(quoteItems);
```

Also call it after `whenCartAnchorReady` fires (so late-hydrating themes get re-marked). Inside the callback from Step 1.3, add before the insertBefore/prepend branches:

```js
      markQuoteLines(quoteItems);
```

- [ ] **Step 3: Add CSS rules to hide price on marked lines**

Append to `public/storefront.css`:

```css
/* Stop-ship: hide pricing on native cart lines for quote-only items.
   Scoped by the data attribute our JS adds after /cart.js fetch. */
[data-qr-quote-only="true"] :is(
  .price,
  .price__current,
  .price__sale,
  .price__regular,
  .cart-item__price,
  .cart-item__price-wrapper,
  .cart-item__totals,
  .cart__line-total,
  .line-item__total,
  .product-price,
  [class*="__price"],
  [class*="-price"]
) {
  visibility: hidden !important;
}

[data-qr-quote-only="true"]::after {
  content: "Quote required";
  display: inline-block;
  margin-inline-start: 8px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5a4a1c;
  background: #fdf7e8;
  border: 1px solid #d9c89b;
  border-radius: 999px;
}
```

`visibility: hidden` (not `display: none`) keeps the layout stable so the theme's grid/flex doesn't collapse unexpectedly.

- [ ] **Step 4: Verify on the cart page**

Reload `/cart` with only the B+W 805 D4 added. Open DevTools → inspect the cart line. Expected:
- The line has `data-qr-quote-only="true"`.
- Any element matching one of the selectors in Step 3 has `visibility: hidden`.
- The "Quote required" pill appears near the line.

Also verify mixed cart: the non-quote product still shows its price normally.

- [ ] **Step 5: Commit**

```bash
git add public/storefront.js public/storefront.css
git commit -m "fix(storefront): hide price on native cart lines for quote-only items

Adds data-qr-quote-only markers to quote-only cart lines (matched by
line key from /cart.js), plus a CSS rule that hides any price-like
selector within marked lines. A 'Quote required' pill is appended via
::after so the line still reads intentionally. Fixes STATUS.md stop-ship #2."
```

---

## Task 3: Shopify Function blocks quote-only at checkout

**Why:** [STATUS.md #3](../review/STATUS.md). The storefront-JS defense doesn't cover the `/cart/<variant>:<qty>?replace` permalink: that URL adds to cart and redirects to checkout without rendering our intercept. A **Shopify Cart Validation Function** runs at Shopify's edge on every checkout attempt and can hard-reject the checkout with a merchant-visible error. It's the only way to close this hole.

**Files:**
- Create: `extensions/quote-cart-validation/shopify.extension.toml`
- Create: `extensions/quote-cart-validation/src/index.js`
- Create: `extensions/quote-cart-validation/src/index.test.js`
- Create: `extensions/quote-cart-validation/input.graphql`

### Background the engineer needs

Shopify Functions are WASM modules that Shopify runs as part of the checkout pipeline. For cart validation:
- **Target:** `purchase.validation.run` (modern target; older `cart.validations.generate.run` still works but new apps should use the modern one).
- **Input:** a GraphQL query that declares what the function needs to read from the cart. We ask for each line's merchandise, its product tags.
- **Output:** `{ errors: [{ localizedMessage, target }] }`. If `errors` is non-empty, checkout is blocked.

**Why tag-based, not metafield-based:** the existing storefront signal is the `quote-only` tag (applied via `app/admin` alongside the `quote.quote_only` metafield — see [CLAUDE.md "Known decisions"](../../CLAUDE.md)). Using the same signal keeps the two enforcement layers consistent. Product tags are in the default cart-validation GraphQL scope — no extra scope grant.

### Steps

- [ ] **Step 1: Scaffold the extension with Shopify CLI**

```bash
cd C:/Users/char/smartspaces
shopify app generate extension --type=function --template=cart-checkout-validation --name=quote-cart-validation
```

When prompted for language, choose **JavaScript** (keeps the repo single-language; Rust is also supported but we don't need its performance here).

Expected: a new directory `extensions/quote-cart-validation/` with a scaffold containing `shopify.extension.toml`, `src/index.js`, `src/index.test.js` (scaffold may name it `run.test.js`), `input.graphql`, `schema.graphql`, and a `package.json`.

- [ ] **Step 2: Inspect the scaffold**

Read the generated files to learn the exact exported function name (usually `run` or `cartValidationsGenerateRun`) and the expected output shape. Note any script name differences from what's written below; keep filenames as-scaffolded rather than renaming.

- [ ] **Step 3: Replace `input.graphql` with the specific fields we need**

```graphql
query RunInput {
  cart {
    lines {
      id
      quantity
      merchandise {
        __typename
        ... on ProductVariant {
          id
          product {
            id
            hasTag: hasAnyTag(tags: ["quote-only"])
          }
        }
      }
    }
  }
}
```

`hasAnyTag` returns a single boolean — cheaper than reading the full tag list. If the scaffold's API version doesn't expose `hasAnyTag`, fall back to:

```graphql
          product {
            id
            tags
          }
```

and filter in JS.

- [ ] **Step 4: Write the function**

Replace `extensions/quote-cart-validation/src/index.js` with:

```js
// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

const NO_ERRORS = /** @type {FunctionRunResult} */ ({ errors: [] });

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const offendingLineIds = input.cart.lines
    .filter((line) => {
      if (line.merchandise.__typename !== "ProductVariant") return false;
      return Boolean(line.merchandise.product.hasTag);
    })
    .map((line) => line.id);

  if (offendingLineIds.length === 0) return NO_ERRORS;

  return {
    errors: offendingLineIds.map((id) => ({
      localizedMessage:
        "This item requires a custom quote and cannot be purchased directly. Please request a quote.",
      target: `$.cart.lines[${input.cart.lines.findIndex((l) => l.id === id)}].quantity`,
    })),
  };
}
```

If the `hasAnyTag` GraphQL field isn't available in the generated types, change the filter to `line.merchandise.product.tags.includes("quote-only")` and adjust the input query from Step 3 accordingly.

- [ ] **Step 5: Write unit tests**

Replace `extensions/quote-cart-validation/src/index.test.js` (or scaffolded `run.test.js`) with:

```js
import { describe, it, expect } from "vitest";
import { run } from "./index.js";

function line(id, variantId, hasTag) {
  return {
    id,
    quantity: 1,
    merchandise: {
      __typename: "ProductVariant",
      id: variantId,
      product: { id: "gid://shopify/Product/" + variantId, hasTag },
    },
  };
}

describe("quote-cart-validation", () => {
  it("allows checkout when no lines are quote-only", () => {
    const result = run({
      cart: { lines: [line("gid://shopify/CartLine/1", "1", false)] },
    });
    expect(result.errors).toEqual([]);
  });

  it("blocks checkout when one line is quote-only", () => {
    const result = run({
      cart: { lines: [line("gid://shopify/CartLine/1", "1", true)] },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].localizedMessage).toMatch(/quote/i);
  });

  it("blocks checkout for each offending line in a mixed cart", () => {
    const result = run({
      cart: {
        lines: [
          line("gid://shopify/CartLine/1", "1", false),
          line("gid://shopify/CartLine/2", "2", true),
          line("gid://shopify/CartLine/3", "3", true),
        ],
      },
    });
    expect(result.errors).toHaveLength(2);
  });

  it("ignores non-variant merchandise (e.g. gift cards) safely", () => {
    const result = run({
      cart: {
        lines: [
          { id: "x", quantity: 1, merchandise: { __typename: "GiftCard" } },
        ],
      },
    });
    expect(result.errors).toEqual([]);
  });
});
```

- [ ] **Step 6: Run tests from the extension directory**

```bash
cd extensions/quote-cart-validation
npm test
```

Expected: all 4 tests pass. If the scaffold uses a different test runner (it should be vitest/jest), adjust syntax.

- [ ] **Step 7: Run tests from the repo root too**

```bash
cd C:/Users/char/smartspaces
npm test
```

Expected: all existing 21 tests still pass, plus the 4 new ones (25 total).

- [ ] **Step 8: Register the extension in the app config**

Confirm `shopify.app.smartspaces-quote.toml` has the access scopes the function needs. Cart validation functions require no new scopes — product tags and cart lines are default. Do NOT edit this file manually unless the CLI didn't already wire the extension; `shopify app generate` handles registration.

Verify by running:

```bash
shopify app info
```

Expected output lists both `quote-storefront` (theme) AND `quote-cart-validation` (function).

- [ ] **Step 9: Deploy the new app version**

```bash
shopify app deploy --force
```

Expected: a new app version (v7 if v6 was last) is created in Shopify Partners. Confirm release when prompted. The function is now live on the dev store.

- [ ] **Step 10: Enable the function on the dev store**

Go to `https://admin.shopify.com/store/smart-spaces-za/settings/checkout`. Scroll to **Checkout rules** (or **Validations** depending on plan tier). Click **Add validation** → select `Smartspaces Quote → Quote cart validation` → enable it.

If the store is on a tier below Shopify Plus, cart validation functions still work but may be labeled differently. If this section isn't available, the merchant is on a plan that doesn't support checkout validation — flag this in the launch checklist (Task 4) and do NOT proceed, because without this, the permalink bypass is unfixable.

- [ ] **Step 11: E2E verify the bypass is closed**

In a private browser window (no cart state), paste into the URL bar:

```
https://<store>.myshopify.com/cart/<variant_id_of_805_D4>:1?replace
```

Expected: Shopify redirects to checkout, then shows a checkout-level error "This item requires a custom quote and cannot be purchased directly. Please request a quote." and the checkout cannot be completed.

Repeat on a non-quote product permalink → checkout proceeds normally.

- [ ] **Step 12: Commit**

```bash
git add extensions/quote-cart-validation/ shopify.app.smartspaces-quote.toml
git commit -m "feat(checkout): cart validation function blocks quote-only at checkout

Adds a new Shopify Function extension targeting purchase.validation.run
that inspects each cart line's product tags and returns a checkout
error for any line tagged quote-only. This closes the permalink bypass
(/cart/<variant>:<qty>?replace) that the storefront JS can't intercept.
Fixes STATUS.md stop-ship #3."
```

---

## Task 4: Launch hygiene — rate limit + password checklist

**Why:** [STATUS.md #4](../review/STATUS.md). Before real traffic: storefront password off (merchant action), and a simple per-IP rate limit on `/apps/quote/submit` so the public form isn't a free spam pipe. [CLAUDE.md](../../CLAUDE.md) forbids paid bot protection (Vercel BotID, hCaptcha, etc.); the existing HMAC + honeypot + a new in-memory rate limit is the accepted design.

**Files:**
- Create: `lib/rateLimit.ts`
- Create: `lib/rateLimit.test.ts`
- Modify: `app/api/proxy/submit/route.ts`
- Create: `docs/launch-checklist.md`

### Steps

- [ ] **Step 1: Write the failing test**

Create `lib/rateLimit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, _resetForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));
  });

  it("allows the first request from a new IP", () => {
    expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("allows requests up to the configured limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks the 6th request within the window", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    const sixth = checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows requests again after the window expires", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(checkRateLimit("5.6.7.8", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
npm test lib/rateLimit.test.ts
```

Expected: tests fail with "Cannot find module './rateLimit'".

- [ ] **Step 3: Implement `lib/rateLimit.ts`**

Create `lib/rateLimit.ts`:

```ts
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (existing.count < opts.limit) {
    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
  return { allowed: false, retryAfterMs: Math.max(0, existing.resetAt - now) };
}

export function _resetForTests(): void {
  buckets.clear();
}
```

Vercel's serverless functions share memory within a single instance only, so this limiter is best-effort (a burst that hits multiple cold instances simultaneously slips through). For our traffic profile (single store, one-off quote submissions) this is acceptable. Documented limitation; future public-distribution would need a shared store.

- [ ] **Step 4: Run the test — expect PASS**

```bash
npm test lib/rateLimit.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Wire the limiter into the submit route**

Edit `app/api/proxy/submit/route.ts`. After the imports (after line 14), add:

```ts
import { checkRateLimit } from "@/lib/rateLimit";
```

Inside `POST`, immediately after the secret guard at line 28 (before the HMAC verification so spam can't force expensive HMAC work), add:

```ts
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkRateLimit(`submit:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }
```

- [ ] **Step 6: Verify typecheck and all tests still pass**

```bash
npm run typecheck
npm test
```

Expected: typecheck exits 0; all tests (existing 21 + 5 rate-limit + 4 cart-validation = 30) pass.

- [ ] **Step 7: Write the launch checklist doc**

Create `docs/launch-checklist.md`:

```markdown
# Launch Checklist — SmartSpaces Quote

Actions the merchant (or whoever owns the dev store) must complete before pointing real traffic at the app. These are manual because they happen in Shopify Admin, not in code.

## Stop-ship gates

- [ ] **Turn off storefront password.** `Online Store → Preferences → Password protection → Disable password`. While enabled, only people with the password can see the storefront — real customers can't reach the request-a-quote flow at all.

- [ ] **Enable the cart-validation function.** `Settings → Checkout → Checkout rules → Add validation → Smartspaces Quote → Quote cart validation → Enable`. Without this the permalink bypass is live. If this setting is not visible, the store is on a Shopify plan that does not include checkout validation — the bypass cannot be closed and this is a **hard blocker** until the plan is upgraded.

- [ ] **Verify `SHOPIFY_SHOW_TOKEN_ON_INSTALL` is unset in Vercel.** `Vercel → Project → Settings → Environment Variables`. This flag should only be `1` during the one-time offline token capture per [CLAUDE.md](../CLAUDE.md "Known decisions"); leaving it on exposes the token on every re-install.

- [ ] **Confirm rate limit is active.** After deploy, curl `/apps/quote/submit` 6 times in 60 s with bad signatures — the 6th should return 429. (The first 5 will 401 — expected; we rate-limit before HMAC on purpose.)

## Deferred (not stop-ship)

Items below are tracked separately in [`docs/review/STATUS.md`](review/STATUS.md) — high/medium/low priority — and are NOT required for a safe launch, only for a polished one.

- Shopify Flow workflows for customer / merchant email (per `flows/README.md`)
- Button icon + "Price on request" copy on quote-only PDPs
- Cart-section CTA visual distinction
- Accessibility pass on form labels and honeypot
- Request-quote page styling
```

- [ ] **Step 8: Commit**

```bash
git add lib/rateLimit.ts lib/rateLimit.test.ts app/api/proxy/submit/route.ts docs/launch-checklist.md
git commit -m "feat(api): per-IP rate limit on quote submit + launch checklist

Adds an in-memory token-bucket limiter (5 req/min/IP) applied before
HMAC verification on /api/proxy/submit, so unsigned spam can't burn
cycles. Ships alongside a launch-checklist.md documenting the
manual merchant actions (password off, cart-validation enable, token
flag unset) that complete stop-ship #4."
```

---

## Task 5: Deploy & acceptance

Only after Tasks 1–4 are green locally.

- [ ] **Step 1: Deploy to Vercel**

```bash
cd C:/Users/char/smartspaces
vercel deploy --prod --yes
```

Expected: deploy completes, URL printed is `https://smartspaces-quote.vercel.app`.

- [ ] **Step 2: Shopify extension deploy (if not done in Task 3.9)**

```bash
shopify app deploy --force
```

- [ ] **Step 3: Walk through the full acceptance script**

Open `/products/b-w-805-d4-signature-bookshelf` on the preview and:
1. Confirm PDP price hidden and button reads "Add to Quote". ✅ (pre-existing)
2. Click "Add to Quote" → cart updates. ✅ (pre-existing)
3. Open `/cart`. Expected: Quote required section renders (Task 1). ✅
4. Confirm native cart line has no price showing (Task 2). ✅
5. Click "Request a quote" CTA → lands on `/pages/request-quote`. ✅ (pre-existing)
6. Fill form, submit → `{ok: true, draftOrderId: "gid://..."}` returned; draft visible in `/admin/draft_orders`. (pre-existing, exercise live now)
7. Try permalink bypass: `https://<store>.myshopify.com/cart/<variant_id>:1?replace` → checkout shows the validation error from Task 3. ✅
8. Hit `/apps/quote/submit` 6 times with bad signatures → 6th returns 429 (Task 4).

- [ ] **Step 4: Capture evidence**

Screenshot each of the 8 states above. Save to `docs/review/post-stopship/` and reference from STATUS.md in a follow-up commit.

- [ ] **Step 5: Merchant handoff**

Send [`docs/launch-checklist.md`](../launch-checklist.md) to the merchant. Do NOT mark the project shipped until the three "Stop-ship gates" in that checklist are ticked by the merchant on the live store.

---

## Self-Review

**Spec coverage (STATUS.md §3 stop-ship):**
- #1 cart render — Task 1 ✅
- #2 cart-line price leak — Task 2 ✅
- #3 permalink bypass — Task 3 ✅
- #4 password + anti-bot — Task 4 ✅ (password via merchant checklist; rate limit in code; fuller bot protection deferred per CLAUDE.md)

**Placeholders:** none. Every step has exact file paths, complete code, and runnable commands.

**Type consistency:** `checkRateLimit` + `RateLimitOptions` + `RateLimitResult` shapes match across test and implementation. `markQuoteLines` + `renderCartSection` use the same `quoteItems` array shape (existing). Shopify Function `run` + test shape matches the scaffold's generated `RunInput` / `FunctionRunResult` types.

**Guardrail check ([CLAUDE.md](../../CLAUDE.md)):**
- No new DB / cache / SaaS ✅ (rate limit is in-memory Map; cart validation is a Shopify-native extension).
- No Polaris / App Bridge ✅ (no admin UI touched).
- No new storefront framework ✅ (storefront remains vanilla JS + Liquid).
- Zod at boundaries ✅ (existing `QuoteSubmissionSchema` untouched).
- No trivial-code tests ✅ (rate limit is non-trivial business logic; cart validation is business logic).
- No narrating comments ✅ (only `// Stop-ship` tags that capture the WHY).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-finish-quote-app-stopship.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
