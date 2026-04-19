import { describe, it, expect } from "vitest";
import { buildDraftOrderInput } from "./draftOrder";
import { QUOTE_REQUEST_TAG, type QuoteSubmission } from "./quote";

const sample: QuoteSubmission = {
  contact_name: "Ada Lovelace",
  contact_email: "ada@example.com",
  contact_phone: "+1 555 0100",
  project_address: "123 Analytical Engine Rd",
  timeline: "next 2 months",
  budget_range: "$50k-$100k",
  notes: "Whole-home audio + lighting.",
  line_items: [
    { variantId: "gid://shopify/ProductVariant/111", productId: "gid://shopify/Product/1", title: "Amp X", qty: 2, note: "black" },
    { variantId: "gid://shopify/ProductVariant/222", productId: "gid://shopify/Product/2", title: "Speaker Y", qty: 6 },
  ],
  floor_plan_file_id: "gid://shopify/GenericFile/900",
};

describe("buildDraftOrderInput", () => {
  const input = buildDraftOrderInput(sample, "gid://shopify/Customer/42");

  it("tags the draft order", () => {
    expect(input.tags).toEqual([QUOTE_REQUEST_TAG]);
  });

  it("sets the customer and email", () => {
    expect(input.purchasingEntity).toEqual({ customerId: "gid://shopify/Customer/42" });
    expect(input.email).toBe("ada@example.com");
  });

  it("maps line items with per-line customer notes", () => {
    const lineItems = input.lineItems as Array<{
      variantId: string;
      quantity: number;
      customAttributes?: Array<{ key: string; value: string }>;
    }>;
    expect(lineItems).toHaveLength(2);
    expect(lineItems[0]).toMatchObject({ variantId: "gid://shopify/ProductVariant/111", quantity: 2 });
    expect(lineItems[0].customAttributes).toEqual([{ key: "customer_note", value: "black" }]);
    expect(lineItems[1].customAttributes).toBeUndefined();
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
        ...sample,
        contact_phone: "",
        project_address: "",
        timeline: "",
        budget_range: "",
        floor_plan_file_id: undefined,
      },
      "gid://shopify/Customer/42",
    );
    const attrs = minimal.customAttributes as Array<{ key: string; value: string }>;
    const keys = attrs.map((a) => a.key);
    expect(keys).toEqual(["source"]);
  });
});
