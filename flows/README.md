# Shopify Flow templates

The app relies on two workflows in **Shopify Flow** (free, install from the Shopify App Store) to send the intake emails. No app-side email code.

## Setup (once per merchant)

1. Install the **Shopify Flow** app.
2. Create two workflows in the Flow editor. Use the recipes below, or import the `.flow` JSON files as starting points (Flow → Workflows → Import).

---

## Workflow 1 — "New quote request → notify merchant"

**Trigger:** `Draft order created`

**Condition:** `{{draftOrder.tags}}` includes `quote-request`

**Action:** Send internal email
- **To:** the merchant's quote contact (e.g., sales@example.com)
- **Subject:** `New quote request: {{ draftOrder.name }}`
- **Body:**
  ```
  A new quote request was submitted.

  Customer: {{ draftOrder.customer.displayName }} <{{ draftOrder.email }}>
  Phone:    {{ draftOrder.customAttributes | where: "key", "phone" | map: "value" | first }}
  Address:  {{ draftOrder.customAttributes | where: "key", "project_address" | map: "value" | first }}
  Timeline: {{ draftOrder.customAttributes | where: "key", "timeline" | map: "value" | first }}

  Items:
  {% for li in draftOrder.lineItems %}
  - {{ li.title }} × {{ li.quantity }}
  {% endfor %}

  Notes:
  {{ draftOrder.note }}

  Open in admin: https://{{ shop.myshopifyDomain }}/admin/draft_orders/{{ draftOrder.legacyResourceId }}
  ```

---

## Workflow 2 — "New quote request → confirm to customer"

**Trigger:** `Draft order created`

**Condition:** `{{draftOrder.tags}}` includes `quote-request`

**Action:** Send customer email
- **To:** `{{ draftOrder.email }}`
- **Subject:** `We received your quote request`
- **Body:**
  ```
  Hi {{ draftOrder.customer.firstName | default: "there" }},

  Thanks for your quote request — we have everything we need to start putting together
  your estimate. Our team will review the items and your project details and be in touch within one business day.

  Your request:
  {% for li in draftOrder.lineItems %}
  - {{ li.title }} × {{ li.quantity }}
  {% endfor %}

  If any details changed, just reply to this email.

  — {{ shop.name }}
  ```

---

## Testing

1. Submit a quote request from the storefront.
2. Confirm the draft order is created with tag `quote-request`.
3. Confirm both emails arrive within ~1 minute (Flow has small latency).

If emails don't fire, check **Shopify Admin → Flow → Run history** for the workflow runs.
