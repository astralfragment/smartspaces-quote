import { describe, it, expect } from "vitest";
import { buildDraftOrderInput, type DraftOrderLineItem } from "./draftOrder";
import { QUOTE_REQUEST_TAG, type QuoteSubmission } from "./quote";

const submission: QuoteSubmission = {
  contact_name: "Ada Lovelace",
  contact_email: "ada@example.com",
  contact_phone: "+1 555 0100",
  project_address: "123 Analytical Engine Rd",
  timeline: "next 2 months",
  budget_range: "$50k-$100k",
  notes: "Whole-home audio + lighting.",
  line_items: [
    {
      variant_id: 111,
      product_id: 1,
      product_title: "Amp X",
      quantity: 2,
      key: "111:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    {
      variant_id: 222,
      product_id: 2,
      product_title: "Speaker Y",
      quantity: 6,
      key: "222:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  ],
};

const lineItems: DraftOrderLineItem[] = submission.line_items.map((li) => ({
  variantId: `gid://shopify/ProductVariant/${li.variant_id}`,
  quantity: li.quantity,
  title: li.product_title,
}));

describe("buildDraftOrderInput", () => {
  const input = buildDraftOrderInput(
    { submission, lineItems, floorPlanFileId: "gid://shopify/GenericFile/900" },
    "gid://shopify/Customer/42",
  );

  it("tags the draft order", () => {
    expect(input.tags).toEqual([QUOTE_REQUEST_TAG]);
  });

  it("sets the customer and email", () => {
    expect(input.purchasingEntity).toEqual({ customerId: "gid://shopify/Customer/42" });
    expect(input.email).toBe("ada@example.com");
  });

  it("maps line items using GID variant ids", () => {
    const items = input.lineItems as Array<{ variantId: string; quantity: number }>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ variantId: "gid://shopify/ProductVariant/111", quantity: 2 });
    expect(items[1]).toMatchObject({ variantId: "gid://shopify/ProductVariant/222", quantity: 6 });
  });

  it("includes source + project metadata as custom attributes", () => {
    const attrs = input.customAttributes as Array<{ key: string; value: string }>;
    const byKey = Object.fromEntries(attrs.map((a) => [a.key, a.value]));
    expect(byKey.source).toBe("quote-request");
    expect(byKey.phone).toBe("+1 555 0100");
    expect(byKey.project_address).toBe("123 Analytical Engine Rd");
    expect(byKey.timeline).toBe("next 2 months");
    expect(byKey.budget_range).toBe("$50k-$100k");
    expect(byKey.floor_plan_file_id).toBe("gid://shopify/GenericFile/900");
  });

  it("omits optional attributes when empty", () => {
    const minimal = buildDraftOrderInput(
      {
        submission: {
          ...submission,
          contact_phone: "",
          project_address: "",
          timeline: "",
          budget_range: "",
        },
        lineItems,
      },
      "gid://shopify/Customer/42",
    );
    const attrs = minimal.customAttributes as Array<{ key: string; value: string }>;
    const keys = attrs.map((a) => a.key);
    expect(keys).toEqual(["source"]);
  });
});
